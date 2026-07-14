import {
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { UserRole } from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import {
  ClassroomService,
  normalizeEmail,
  normalizeJoinCode,
} from '@/modules/classroom/classroom.service';
import {
  Classroom,
  ClassroomStatus,
} from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import {
  ClassroomInvitation,
  ClassroomInvitationStatus,
} from '@/modules/classroom/entities/classroom-invitation.entity';
import type {
  ClassroomInvitationMail,
  MailService,
} from '@/modules/mail/mail.service';
import type { User } from '@/modules/user/entities/user.entity';

type RepositoryMock<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  exists: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  target?: T;
};

function repositoryMock<T extends object>(): RepositoryMock<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn((value: T) => value),
    save: jest.fn((value: T) => Promise.resolve(value)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

const teacher = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'teacher@example.com',
  fullName: 'Cô Bee',
  role: UserRole.TEACHER,
} as User;

const student = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'student@example.com',
  fullName: 'Bạn Ong',
  role: UserRole.STUDENT,
} as User;

function classroomFixture(overrides: Partial<Classroom> = {}): Classroom {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    teacherId: teacher.id,
    teacher,
    name: 'Toán 10A1',
    description: null,
    subject: 'Toán',
    grade: '10',
    status: ClassroomStatus.ACTIVE,
    joinCode: 'ABCD-EFGH',
    joinToken: 'generic-token',
    members: [],
    invitations: [],
    materials: [],
    quizAssignments: [],
    createdAt: new Date('2026-07-12T01:00:00.000Z'),
    updatedAt: new Date('2026-07-12T01:00:00.000Z'),
    ...overrides,
  };
}

function invitationFixture(
  overrides: Partial<ClassroomInvitation> = {},
): ClassroomInvitation {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    classroomId: '10000000-0000-4000-8000-000000000001',
    classroom: classroomFixture(),
    email: 'student@example.com',
    tokenHash: 'a'.repeat(64),
    status: ClassroomInvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    createdAt: new Date('2026-07-12T01:00:00.000Z'),
    updatedAt: new Date('2026-07-12T01:00:00.000Z'),
    ...overrides,
  };
}

describe('ClassroomService', () => {
  let classroomRepository: RepositoryMock<Classroom>;
  let memberRepository: RepositoryMock<ClassroomMember>;
  let invitationRepository: RepositoryMock<ClassroomInvitation>;
  let userRepository: RepositoryMock<User>;
  let mailService: {
    sendClassroomInvitation: jest.Mock;
    sendClassroomMemberAdded: jest.Mock;
  };
  let service: ClassroomService;

  beforeEach(() => {
    classroomRepository = repositoryMock<Classroom>();
    memberRepository = repositoryMock<ClassroomMember>();
    invitationRepository = repositoryMock<ClassroomInvitation>();
    userRepository = repositoryMock<User>();
    mailService = {
      sendClassroomInvitation: jest.fn().mockResolvedValue(undefined),
      sendClassroomMemberAdded: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((_key: string, fallback: string) => fallback),
    } as unknown as ConfigService;
    service = new ClassroomService(
      classroomRepository as unknown as Repository<Classroom>,
      memberRepository as unknown as Repository<ClassroomMember>,
      invitationRepository as unknown as Repository<ClassroomInvitation>,
      userRepository as unknown as Repository<User>,
      config,
      mailService as unknown as MailService,
    );
  });

  it('normalizes email and a compact join code', () => {
    expect(normalizeEmail(' Student@Example.COM ')).toBe('student@example.com');
    expect(normalizeJoinCode('abcd efgh')).toBe('ABCD-EFGH');
  });

  it('adds an existing student and creates one pending email invitation', async () => {
    const classroom = classroomFixture();
    classroomRepository.findOne.mockResolvedValue(classroom);
    userRepository.findOne
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(null);
    memberRepository.findOne.mockResolvedValue(null);
    invitationRepository.findOne.mockResolvedValue(null);
    let createdInvitation: ClassroomInvitation | undefined;
    let sentInvitation: ClassroomInvitationMail | undefined;
    mailService.sendClassroomInvitation.mockImplementation(
      (input: ClassroomInvitationMail) => {
        sentInvitation = input;
        return Promise.resolve();
      },
    );
    invitationRepository.create.mockImplementation(
      (value: ClassroomInvitation) => {
        createdInvitation = value;
        return value;
      },
    );
    invitationRepository.save.mockImplementation((value: ClassroomInvitation) =>
      Promise.resolve({
        ...value,
        id: value.id ?? 'new-invitation-id',
        createdAt: value.createdAt ?? new Date(),
        updatedAt: value.updatedAt ?? new Date(),
      }),
    );

    const result = await service.inviteStudents(classroom.id, teacher.id, {
      emails: [' Student@Example.com ', 'new@example.com'],
    });

    expect(result).toEqual({
      results: [
        { email: 'student@example.com', status: 'added' },
        { email: 'new@example.com', status: 'invited' },
      ],
    });
    expect(memberRepository.save).toHaveBeenCalledWith({
      classroomId: classroom.id,
      userId: student.id,
    });
    expect(mailService.sendClassroomMemberAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@example.com',
        classroomUrl: 'http://localhost:1111/student/classes',
      }),
    );
    expect(sentInvitation?.email).toBe('new@example.com');
    expect(sentInvitation?.invitationUrl).toMatch(
      /^http:\/\/localhost:1111\/join\/.+\?type=invitation$/,
    );
    expect(createdInvitation?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (createdInvitation?.expiresAt.getTime() ?? 0) - Date.now(),
    ).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it('rejects an existing non-student account before adding anyone', async () => {
    classroomRepository.findOne.mockResolvedValue(classroomFixture());
    userRepository.findOne.mockResolvedValue({
      ...teacher,
      email: 'other-teacher@example.com',
    });

    await expect(
      service.inviteStudents(
        '10000000-0000-4000-8000-000000000001',
        teacher.id,
        { emails: ['OTHER-TEACHER@example.com'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(memberRepository.save).not.toHaveBeenCalled();
    expect(invitationRepository.save).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate membership insert as an idempotent join', async () => {
    const basicClassroom = classroomFixture({
      teacher: undefined as unknown as User,
    });
    const loadedClassroom = classroomFixture();
    classroomRepository.findOne
      .mockResolvedValueOnce(basicClassroom)
      .mockResolvedValueOnce(loadedClassroom);
    memberRepository.findOne.mockResolvedValue(null);
    memberRepository.save.mockRejectedValue({ driverError: { code: '23505' } });

    const result = await service.joinByCode('abcd-efgh', student.id);

    expect(result.alreadyMember).toBe(true);
    expect(result.classroom.id).toBe(loadedClassroom.id);
  });

  it('does not accept an email invitation from a different account', async () => {
    invitationRepository.findOne.mockResolvedValue(invitationFixture());
    const anotherStudent: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000003',
      email: 'another@example.com',
      role: UserRole.STUDENT,
    };

    await expect(
      service.acceptEmailInvitation('raw-token', anotherStudent),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'expired',
      ClassroomInvitationStatus.PENDING,
      new Date(Date.now() - 60_000),
    ],
    [
      'revoked',
      ClassroomInvitationStatus.REVOKED,
      new Date(Date.now() + 60_000),
    ],
  ])(
    'rejects a %s email invitation preview as gone',
    async (_label, status, expiresAt) => {
      invitationRepository.findOne.mockResolvedValue(
        invitationFixture({ status, expiresAt }),
      );

      await expect(
        service.previewEmailInvitation('unusable-token'),
      ).rejects.toBeInstanceOf(GoneException);
    },
  );

  it('previews and accepts an already accepted email invitation idempotently', async () => {
    const invitation = invitationFixture({
      status: ClassroomInvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    const loadedClassroom = classroomFixture({
      members: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          classroomId: invitation.classroomId,
          userId: student.id,
          user: student,
          classroom: undefined as unknown as Classroom,
          joinedAt: new Date(),
        },
      ],
    });
    invitationRepository.findOne.mockResolvedValue(invitation);
    classroomRepository.findOne
      .mockResolvedValueOnce(loadedClassroom)
      .mockResolvedValueOnce(classroomFixture())
      .mockResolvedValueOnce(loadedClassroom);

    const preview = await service.previewEmailInvitation('raw-token');
    const result = await service.acceptEmailInvitation('raw-token', {
      id: student.id,
      email: 'STUDENT@example.com',
      role: UserRole.STUDENT,
    });

    expect(preview.kind).toBe('email');
    expect(result.alreadyMember).toBe(true);
    expect(result.classroom.memberCount).toBe(1);
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it('hides invitation email addresses from a student member detail', async () => {
    const classroom = classroomFixture({
      members: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          classroomId: '10000000-0000-4000-8000-000000000001',
          userId: student.id,
          user: student,
          classroom: undefined as unknown as Classroom,
          joinedAt: new Date(),
        },
      ],
      invitations: [invitationFixture({ email: 'private@example.com' })],
    });
    classroomRepository.findOne.mockResolvedValue(classroom);

    const detail = await service.getDetail(classroom.id, {
      id: student.id,
      email: student.email,
      role: UserRole.STUDENT,
    });

    expect(detail.invitations).toEqual([]);
    expect(detail.memberCount).toBe(1);
  });

  it('rejects classroom detail for a user who is neither owner nor member', async () => {
    const classroom = classroomFixture();
    classroomRepository.findOne.mockResolvedValue(classroom);

    await expect(
      service.getDetail(classroom.id, {
        id: '00000000-0000-4000-8000-000000000099',
        email: 'outsider@example.com',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
