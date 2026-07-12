import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { In, Raw, Repository } from 'typeorm';
import {
  UserRole,
  type ClassroomDetail,
  type ClassroomInvitation as ClassroomInvitationResponse,
  type ClassroomInvitationStatus as ClassroomInvitationStatusResponse,
  type ClassroomInviteResult,
  type ClassroomJoinPreview,
  type ClassroomSummary,
  type InviteStudentsResponse,
  type JoinClassroomResult,
  type RegenerateClassroomAccessResponse,
} from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { MailService } from '@/modules/mail/mail.service';
import { User } from '@/modules/user/entities/user.entity';
import { CreateClassroomDto } from '@/modules/classroom/dto/create-classroom.dto';
import { InviteStudentsDto } from '@/modules/classroom/dto/invite-students.dto';
import {
  Classroom,
  ClassroomStatus,
} from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import {
  ClassroomInvitation,
  ClassroomInvitationStatus,
} from '@/modules/classroom/entities/classroom-invitation.entity';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_SEGMENT_LENGTH = 4;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_GENERATION_ATTEMPTS = 10;

type MailJob = () => Promise<void>;

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);

  constructor(
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(ClassroomMember)
    private readonly memberRepository: Repository<ClassroomMember>,
    @InjectRepository(ClassroomInvitation)
    private readonly invitationRepository: Repository<ClassroomInvitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async create(
    teacherId: string,
    dto: CreateClassroomDto,
  ): Promise<ClassroomDetail> {
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });
    if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
    if (teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Chỉ giáo viên mới có thể tạo lớp học');
    }

    const [joinCode, joinToken] = await Promise.all([
      this.generateUniqueJoinCode(),
      this.generateUniqueJoinToken(),
    ]);
    const classroom = this.classroomRepository.create({
      teacherId,
      teacher,
      name: dto.name,
      description: dto.description ?? null,
      subject: dto.subject ?? null,
      grade: dto.grade ?? null,
      status: ClassroomStatus.ACTIVE,
      joinCode,
      joinToken,
      members: [],
      invitations: [],
    });
    const saved = await this.classroomRepository.save(classroom);
    return this.toDetail(saved, true);
  }

  async listMine(currentUser: AuthenticatedUser): Promise<ClassroomSummary[]> {
    let classroomIds: string[] | undefined;
    if (currentUser.role === UserRole.STUDENT) {
      const memberships = await this.memberRepository.find({
        where: { userId: currentUser.id },
      });
      classroomIds = memberships.map((membership) => membership.classroomId);
      if (classroomIds.length === 0) return [];
    }

    const classrooms = await this.classroomRepository.find({
      where:
        currentUser.role === UserRole.TEACHER
          ? { teacherId: currentUser.id }
          : { id: In(classroomIds ?? []) },
      relations: {
        teacher: true,
        members: { user: true },
        invitations: true,
        materials: true,
      },
      order: { createdAt: 'DESC' },
    });
    return classrooms.map((classroom) => this.toSummary(classroom));
  }

  async getDetail(
    classroomId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ClassroomDetail> {
    const classroom = await this.loadClassroom(classroomId);
    const isOwner = classroom.teacherId === currentUser.id;
    const isMember = classroom.members.some(
      (member) => member.userId === currentUser.id,
    );
    if (!isOwner && !isMember) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học này');
    }
    return this.toDetail(classroom, isOwner);
  }

  async inviteStudents(
    classroomId: string,
    teacherId: string,
    dto: InviteStudentsDto,
  ): Promise<InviteStudentsResponse> {
    const classroom = await this.loadOwnedClassroom(classroomId, teacherId);
    const emails = [...new Set(dto.emails.map(normalizeEmail))];
    if (emails.length === 0) {
      throw new BadRequestException('Cần nhập ít nhất một email');
    }

    const users = new Map<string, User | null>();
    for (const email of emails) {
      const user = await this.findUserByEmail(email);
      if (user && user.role !== UserRole.STUDENT) {
        throw new BadRequestException(
          `Email ${email} thuộc tài khoản không phải học sinh`,
        );
      }
      users.set(email, user);
    }

    const results: ClassroomInviteResult[] = [];
    const mailJobs: MailJob[] = [];
    for (const email of emails) {
      const user = users.get(email) ?? null;
      if (user) {
        const inserted = await this.addMemberIdempotently(
          classroom.id,
          user.id,
        );
        if (!inserted) {
          results.push({ email, status: 'already_member' });
          continue;
        }

        await this.invitationRepository.update(
          {
            classroomId: classroom.id,
            email,
            status: ClassroomInvitationStatus.PENDING,
          },
          {
            status: ClassroomInvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
        );
        results.push({ email, status: 'added' });
        mailJobs.push(() =>
          this.mailService.sendClassroomMemberAdded({
            email,
            studentName: user.fullName,
            teacherName: classroom.teacher.fullName,
            classroomName: classroom.name,
            classroomUrl: this.classroomUrl(),
          }),
        );
        continue;
      }

      const pendingInvitation = await this.invitationRepository.findOne({
        where: {
          classroomId: classroom.id,
          email,
          status: ClassroomInvitationStatus.PENDING,
        },
      });
      if (pendingInvitation && pendingInvitation.expiresAt > new Date()) {
        results.push({ email, status: 'already_invited' });
        continue;
      }
      if (pendingInvitation) {
        pendingInvitation.status = ClassroomInvitationStatus.EXPIRED;
        await this.invitationRepository.save(pendingInvitation);
      }

      const token = createUrlToken();
      const invitation = this.invitationRepository.create({
        classroomId: classroom.id,
        classroom,
        email,
        tokenHash: hashToken(token),
        status: ClassroomInvitationStatus.PENDING,
        expiresAt: invitationExpiresAt(),
        acceptedAt: null,
      });
      try {
        await this.invitationRepository.save(invitation);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          results.push({ email, status: 'already_invited' });
          continue;
        }
        throw error;
      }
      results.push({ email, status: 'invited' });
      mailJobs.push(() =>
        this.mailService.sendClassroomInvitation({
          email,
          teacherName: classroom.teacher.fullName,
          classroomName: classroom.name,
          invitationUrl: this.emailInvitationUrl(token),
          expiresAt: invitation.expiresAt,
        }),
      );
    }

    await this.runMailJobs(mailJobs);
    return { results };
  }

  async resendInvitation(
    classroomId: string,
    invitationId: string,
    teacherId: string,
  ): Promise<ClassroomInvitationResponse> {
    const classroom = await this.loadOwnedClassroom(classroomId, teacherId);
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, classroomId },
    });
    if (!invitation) {
      throw new NotFoundException('Lời mời không tồn tại');
    }
    if (invitation.status === ClassroomInvitationStatus.ACCEPTED) {
      throw new ConflictException('Lời mời này đã được chấp nhận');
    }
    if (invitation.status === ClassroomInvitationStatus.REVOKED) {
      throw new ConflictException('Lời mời này đã bị thu hồi');
    }

    const token = createUrlToken();
    invitation.tokenHash = hashToken(token);
    invitation.status = ClassroomInvitationStatus.PENDING;
    invitation.expiresAt = invitationExpiresAt();
    invitation.acceptedAt = null;
    const saved = await this.invitationRepository.save(invitation);
    await this.runMailJobs([
      () =>
        this.mailService.sendClassroomInvitation({
          email: saved.email,
          teacherName: classroom.teacher.fullName,
          classroomName: classroom.name,
          invitationUrl: this.emailInvitationUrl(token),
          expiresAt: saved.expiresAt,
        }),
    ]);
    return this.toInvitation(saved);
  }

  async revokeInvitation(
    classroomId: string,
    invitationId: string,
    teacherId: string,
  ): Promise<void> {
    await this.loadOwnedClassroom(classroomId, teacherId);
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, classroomId },
    });
    if (!invitation) {
      throw new NotFoundException('Lời mời không tồn tại');
    }
    if (invitation.status === ClassroomInvitationStatus.ACCEPTED) {
      throw new ConflictException(
        'Không thể thu hồi lời mời đã được chấp nhận',
      );
    }
    if (invitation.status === ClassroomInvitationStatus.REVOKED) return;

    invitation.status =
      invitation.expiresAt <= new Date()
        ? ClassroomInvitationStatus.EXPIRED
        : ClassroomInvitationStatus.REVOKED;
    await this.invitationRepository.save(invitation);
  }

  async regenerateAccess(
    classroomId: string,
    teacherId: string,
  ): Promise<RegenerateClassroomAccessResponse> {
    const classroom = await this.loadOwnedClassroom(classroomId, teacherId);
    const [joinCode, joinToken] = await Promise.all([
      this.generateUniqueJoinCode(),
      this.generateUniqueJoinToken(),
    ]);
    classroom.joinCode = joinCode;
    classroom.joinToken = joinToken;
    await this.classroomRepository.save(classroom);
    return { joinCode, joinUrl: this.joinUrl(joinToken) };
  }

  async joinByCode(
    code: string,
    studentId: string,
  ): Promise<JoinClassroomResult> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        joinCode: normalizeJoinCode(code),
        status: ClassroomStatus.ACTIVE,
      },
    });
    if (!classroom) throw new NotFoundException('Mã lớp không hợp lệ');
    return this.joinClassroom(classroom, studentId);
  }

  async previewJoinLink(token: string): Promise<ClassroomJoinPreview> {
    const classroom = await this.classroomRepository.findOne({
      where: { joinToken: token, status: ClassroomStatus.ACTIVE },
      relations: { teacher: true },
    });
    if (!classroom) {
      throw new NotFoundException('Liên kết tham gia lớp không hợp lệ');
    }
    return this.toPreview('link', classroom, null, null);
  }

  async joinByLink(
    token: string,
    studentId: string,
  ): Promise<JoinClassroomResult> {
    const classroom = await this.classroomRepository.findOne({
      where: { joinToken: token, status: ClassroomStatus.ACTIVE },
    });
    if (!classroom) {
      throw new NotFoundException('Liên kết tham gia lớp không hợp lệ');
    }
    return this.joinClassroom(classroom, studentId);
  }

  async previewEmailInvitation(token: string): Promise<ClassroomJoinPreview> {
    const invitation = await this.loadUsableInvitation(token, true);
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: invitation.classroomId,
        status: ClassroomStatus.ACTIVE,
      },
      relations: { teacher: true },
    });
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    return this.toPreview(
      'email',
      classroom,
      invitation.email,
      invitation.expiresAt,
    );
  }

  async acceptEmailInvitation(
    token: string,
    currentUser: AuthenticatedUser,
  ): Promise<JoinClassroomResult> {
    const invitation = await this.loadUsableInvitation(token, true);
    if (
      !currentUser.email ||
      normalizeEmail(currentUser.email) !== invitation.email
    ) {
      throw new ForbiddenException(
        'Lời mời này được gửi tới một tài khoản email khác',
      );
    }

    const classroom = await this.classroomRepository.findOne({
      where: {
        id: invitation.classroomId,
        status: ClassroomStatus.ACTIVE,
      },
    });
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    if (invitation.status === ClassroomInvitationStatus.ACCEPTED) {
      return {
        classroom: this.toSummary(await this.loadClassroom(classroom.id)),
        alreadyMember: true,
      };
    }

    const inserted = await this.addMemberIdempotently(
      classroom.id,
      currentUser.id,
    );
    invitation.status = ClassroomInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await this.invitationRepository.save(invitation);
    return {
      classroom: this.toSummary(await this.loadClassroom(classroom.id)),
      alreadyMember: !inserted,
    };
  }

  private async joinClassroom(
    classroom: Classroom,
    studentId: string,
  ): Promise<JoinClassroomResult> {
    const inserted = await this.addMemberIdempotently(classroom.id, studentId);
    return {
      classroom: this.toSummary(await this.loadClassroom(classroom.id)),
      alreadyMember: !inserted,
    };
  }

  private async addMemberIdempotently(
    classroomId: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await this.memberRepository.findOne({
      where: { classroomId, userId },
    });
    if (existing) return false;

    const membership = this.memberRepository.create({ classroomId, userId });
    try {
      await this.memberRepository.save(membership);
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  private async loadUsableInvitation(
    token: string,
    allowAccepted = false,
  ): Promise<ClassroomInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { tokenHash: hashToken(token) },
    });
    if (!invitation) throw new NotFoundException('Lời mời không hợp lệ');
    if (invitation.status === ClassroomInvitationStatus.REVOKED) {
      throw new GoneException('Lời mời đã bị thu hồi');
    }
    if (invitation.status === ClassroomInvitationStatus.ACCEPTED) {
      if (allowAccepted) return invitation;
      throw new ConflictException('Lời mời đã được chấp nhận');
    }
    if (
      invitation.status === ClassroomInvitationStatus.EXPIRED ||
      invitation.expiresAt <= new Date()
    ) {
      if (invitation.status !== ClassroomInvitationStatus.EXPIRED) {
        invitation.status = ClassroomInvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new GoneException('Lời mời đã hết hạn');
    }
    return invitation;
  }

  private async loadOwnedClassroom(
    classroomId: string,
    teacherId: string,
  ): Promise<Classroom> {
    const classroom = await this.loadClassroom(classroomId);
    if (classroom.teacherId !== teacherId) {
      throw new ForbiddenException('Bạn không có quyền quản lý lớp học này');
    }
    return classroom;
  }

  private async loadClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classroomRepository.findOne({
      where: { id: classroomId },
      relations: {
        teacher: true,
        members: { user: true },
        invitations: true,
        materials: true,
      },
    });
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    return classroom;
  }

  private findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        email: Raw((column) => `LOWER(${column}) = :email`, { email }),
      },
    });
  }

  private async generateUniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
      const first = randomCharacters(JOIN_CODE_SEGMENT_LENGTH);
      const second = randomCharacters(JOIN_CODE_SEGMENT_LENGTH);
      const joinCode = `${first}-${second}`;
      if (!(await this.classroomRepository.exists({ where: { joinCode } }))) {
        return joinCode;
      }
    }
    throw new InternalServerErrorException('Không thể tạo mã lớp duy nhất');
  }

  private async generateUniqueJoinToken(): Promise<string> {
    for (let attempt = 0; attempt < TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
      const joinToken = createUrlToken();
      if (!(await this.classroomRepository.exists({ where: { joinToken } }))) {
        return joinToken;
      }
    }
    throw new InternalServerErrorException(
      'Không thể tạo liên kết lớp duy nhất',
    );
  }

  private toSummary(classroom: Classroom): ClassroomSummary {
    const now = new Date();
    return {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description ?? null,
      subject: classroom.subject ?? null,
      grade: classroom.grade ?? null,
      status: classroom.status,
      joinCode: classroom.joinCode,
      joinUrl: this.joinUrl(classroom.joinToken),
      memberCount: classroom.members?.length ?? 0,
      pendingInvitationCount:
        classroom.invitations?.filter(
          (invitation) =>
            invitation.status === ClassroomInvitationStatus.PENDING &&
            invitation.expiresAt > now,
        ).length ?? 0,
      createdAt: classroom.createdAt.toISOString(),
    };
  }

  private toDetail(
    classroom: Classroom,
    includeInvitations: boolean,
  ): ClassroomDetail {
    return {
      ...this.toSummary(classroom),
      teacher: {
        id: classroom.teacher.id,
        fullName: classroom.teacher.fullName,
      },
      members: (classroom.members ?? [])
        .slice()
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .map((member) => ({
          id: member.id,
          userId: member.userId,
          fullName: member.user.fullName,
          email: member.user.email,
          joinedAt: member.joinedAt.toISOString(),
        })),
      invitations: includeInvitations
        ? (classroom.invitations ?? [])
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((invitation) => this.toInvitation(invitation))
        : [],
      // Nội dung học tập sẽ được lấy từ module tài liệu và quiz khi các module
      // đó được triển khai. Giữ contract ổn định để client hiển thị empty state.
      materials: (classroom.materials ?? [])
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description,
          type: material.type,
          url: material.url,
          originalName: material.originalName,
          mimeType: material.mimeType,
          size: material.size,
          createdAt: material.createdAt.toISOString(),
          updatedAt: material.updatedAt.toISOString(),
        })),
      quizzes: [],
    };
  }

  private toInvitation(
    invitation: ClassroomInvitation,
  ): ClassroomInvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      status: effectiveInvitationStatus(invitation),
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  private toPreview(
    kind: 'link' | 'email',
    classroom: Classroom,
    invitedEmail: string | null,
    expiresAt: Date | null,
  ): ClassroomJoinPreview {
    return {
      kind,
      classroom: {
        id: classroom.id,
        name: classroom.name,
        subject: classroom.subject ?? null,
        grade: classroom.grade ?? null,
        teacherName: classroom.teacher.fullName,
      },
      invitedEmail,
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  }

  private joinUrl(token: string): string {
    return `${this.webUrl()}/join/${encodeURIComponent(token)}`;
  }

  private emailInvitationUrl(token: string): string {
    return `${this.webUrl()}/join/${encodeURIComponent(token)}?type=invitation`;
  }

  private classroomUrl(): string {
    return `${this.webUrl()}/student/classes`;
  }

  private webUrl(): string {
    return this.config
      .get<string>('WEB_URL', 'http://localhost:1111')
      .replace(/\/$/, '');
  }

  private async runMailJobs(jobs: MailJob[]): Promise<void> {
    const results = await Promise.allSettled(jobs.map((job) => job()));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          'Không thể gửi email lớp học',
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeJoinCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z2-9]{8}$/.test(normalized)
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

function randomCharacters(length: number): string {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return result;
}

function createUrlToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invitationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_LIFETIME_MS);
}

function effectiveInvitationStatus(
  invitation: ClassroomInvitation,
): ClassroomInvitationStatusResponse {
  if (
    invitation.status === ClassroomInvitationStatus.PENDING &&
    invitation.expiresAt <= new Date()
  ) {
    return 'expired';
  }
  return invitation.status;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return candidate.code === '23505' || candidate.driverError?.code === '23505';
}
