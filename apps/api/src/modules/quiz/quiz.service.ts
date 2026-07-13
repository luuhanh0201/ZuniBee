import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  UserRole,
  type QuizDetail,
  type QuizResultRow,
  type QuizSummary,
} from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { User } from '@/modules/user/entities/user.entity';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { Quiz, QuizStatus, QuizVisibility } from './entities/quiz.entity';
import {
  QuizQuestion,
  QuizQuestionType,
} from './entities/quiz-question.entity';
import { QuizQuestionOption } from './entities/quiz-question-option.entity';
import {
  QuizAssignment,
  QuizAssignmentTargetType,
} from './entities/quiz-assignment.entity';
import { QuizAttempt, QuizAttemptStatus } from './entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from './entities/quiz-attempt-answer.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { ConfigureQuizDto } from './dto/configure-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import {
  compareAttemptsForRanking,
  gradeAnswer,
  redistributeScores,
} from './quiz-scoring.util';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly questions: Repository<QuizQuestion>,
    @InjectRepository(QuizQuestionOption)
    private readonly options: Repository<QuizQuestionOption>,
    @InjectRepository(QuizAssignment)
    private readonly assignments: Repository<QuizAssignment>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(QuizAttemptAnswer)
    private readonly answers: Repository<QuizAttemptAnswer>,
    @InjectRepository(Classroom)
    private readonly classrooms: Repository<Classroom>,
    @InjectRepository(ClassroomMember)
    private readonly members: Repository<ClassroomMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(teacherId: string, dto: CreateQuizDto): Promise<QuizDetail> {
    const quiz = await this.quizzes.save(
      this.quizzes.create({
        teacherId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: QuizStatus.DRAFT,
        totalScore: 10,
        maxAttempts: 1,
        visibility: QuizVisibility.PRIVATE_CLASS,
        questions: [],
        assignments: [],
        attempts: [],
      }),
    );
    return this.toDetail(await this.load(quiz.id), teacherId);
  }

  async listMine(teacherId: string): Promise<QuizSummary[]> {
    const rows = await this.quizzes.find({
      where: { teacherId },
      relations: { questions: true },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((quiz) => this.toSummary(quiz));
  }

  async get(
    id: string,
    currentUser: AuthenticatedUser | null,
  ): Promise<QuizDetail> {
    const quiz = await this.load(id);
    await this.assertCanView(quiz, currentUser);
    return this.toDetail(quiz, currentUser?.id ?? null);
  }

  async update(
    id: string,
    teacherId: string,
    dto: UpdateQuizDto,
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    if (dto.title !== undefined) quiz.title = dto.title.trim();
    if (dto.description !== undefined)
      quiz.description = dto.description?.trim() || null;
    await this.quizzes.save(quiz);
    return this.toDetail(await this.load(id), teacherId);
  }

  async configure(
    id: string,
    teacherId: string,
    dto: ConfigureQuizDto,
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    if (dto.totalScore !== undefined && dto.totalScore !== quiz.totalScore) {
      await this.assertStructureEditable(id);
      quiz.totalScore = dto.totalScore;
    }
    if (dto.timeLimitSeconds !== undefined)
      quiz.timeLimitSeconds = dto.timeLimitSeconds;
    if (dto.opensAt !== undefined)
      quiz.opensAt = dto.opensAt ? new Date(dto.opensAt) : null;
    if (dto.dueAt !== undefined)
      quiz.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (quiz.opensAt && quiz.dueAt && quiz.dueAt <= quiz.opensAt) {
      throw new BadRequestException('Hạn nộp phải sau thời gian mở');
    }
    if (
      dto.visibility !== undefined &&
      dto.visibility !== quiz.visibility &&
      quiz.assignments.length > 0
    ) {
      throw new ConflictException(
        'Hãy xóa các phân phối hiện tại trước khi đổi phạm vi quiz',
      );
    }
    if (dto.visibility !== undefined) quiz.visibility = dto.visibility;
    if (dto.leaderboardMode !== undefined)
      quiz.leaderboardMode = dto.leaderboardMode;
    if (dto.maxAttempts !== undefined) quiz.maxAttempts = dto.maxAttempts;
    else if (dto.visibility !== undefined && quiz.maxAttempts === 1) {
      quiz.maxAttempts = dto.visibility === QuizVisibility.PUBLIC ? null : 1;
    }
    await this.quizzes.save(quiz);
    if (dto.totalScore !== undefined)
      await this.redistribute(id, quiz.totalScore);
    return this.toDetail(await this.load(id), teacherId);
  }

  async publish(id: string, teacherId: string): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    if (quiz.questions.length === 0)
      throw new BadRequestException('Quiz cần ít nhất một câu hỏi');
    quiz.questions.forEach(validateQuestion);
    quiz.status = QuizStatus.PUBLISHED;
    await this.quizzes.save(quiz);
    return this.toDetail(quiz, teacherId);
  }

  async unpublish(id: string, teacherId: string): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    quiz.status = QuizStatus.DRAFT;
    await this.quizzes.save(quiz);
    return this.toDetail(quiz, teacherId);
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const quiz = await this.loadOwned(id, teacherId);
    await this.assertStructureEditable(id);
    await this.quizzes.remove(quiz);
  }

  async addQuestion(
    id: string,
    teacherId: string,
    dto: CreateQuestionDto,
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    await this.assertStructureEditable(id);
    await this.dataSource.transaction(async (manager) => {
      const question = await manager.save(
        QuizQuestion,
        manager.create(QuizQuestion, {
          quizId: id,
          type: dto.type,
          content: dto.content.trim(),
          explanation: dto.explanation?.trim() || null,
          showExplanation: dto.showExplanation ?? true,
          displayOrder: quiz.questions.length,
          score: '0',
          options: [],
        }),
      );
      await manager.save(
        QuizQuestionOption,
        dto.options.map((option, index) =>
          manager.create(QuizQuestionOption, {
            questionId: question.id,
            content: option.content.trim(),
            isCorrect: option.isCorrect,
            displayOrder: index,
          }),
        ),
      );
    });
    await this.redistribute(id, quiz.totalScore);
    return this.toDetail(await this.load(id), teacherId);
  }

  async updateQuestion(
    id: string,
    questionId: string,
    teacherId: string,
    dto: UpdateQuestionDto,
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    const question = quiz.questions.find((item) => item.id === questionId);
    if (!question) throw new NotFoundException('Câu hỏi không tồn tại');
    const hadAttempts = await this.attempts.exists({ where: { quizId: id } });
    if (hadAttempts && dto.type !== undefined && dto.type !== question.type) {
      throw new ConflictException(
        'Không thể đổi loại câu hỏi khi quiz đã có lượt làm',
      );
    }
    const oldCorrect = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort()
      .join(',');
    if (dto.type !== undefined) question.type = dto.type;
    if (dto.content !== undefined) question.content = dto.content.trim();
    if (dto.explanation !== undefined)
      question.explanation = dto.explanation?.trim() || null;
    if (dto.showExplanation !== undefined)
      question.showExplanation = dto.showExplanation;
    await this.questions.save(question);
    if (dto.options) {
      if (hadAttempts) {
        if (
          dto.options.some((option) => !option.id) ||
          dto.options.length !== question.options.length ||
          question.options.some(
            (current) =>
              !dto.options?.some((option) => option.id === current.id),
          )
        ) {
          throw new ConflictException(
            'Không thể thêm hoặc xóa lựa chọn khi quiz đã có lượt làm',
          );
        }
        question.options = await this.options.save(
          dto.options.map((option, index) => {
            const current = question.options.find(
              (item) => item.id === option.id,
            )!;
            current.content = option.content.trim();
            current.isCorrect = option.isCorrect;
            current.displayOrder = index;
            return current;
          }),
        );
      } else {
        await this.options.delete({ questionId });
        question.options = await this.options.save(
          dto.options.map((option, index) =>
            this.options.create({
              questionId,
              content: option.content.trim(),
              isCorrect: option.isCorrect,
              displayOrder: index,
            }),
          ),
        );
      }
    }
    const newCorrect = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort()
      .join(',');
    if (hadAttempts && oldCorrect !== newCorrect) {
      quiz.answersChangedAt = new Date();
      await this.quizzes.save(quiz);
    }
    return this.toDetail(await this.load(id), teacherId);
  }

  async deleteQuestion(
    id: string,
    questionId: string,
    teacherId: string,
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    await this.assertStructureEditable(id);
    const question = quiz.questions.find((item) => item.id === questionId);
    if (!question) throw new NotFoundException('Câu hỏi không tồn tại');
    await this.questions.remove(question);
    await this.reorderRows(
      id,
      quiz.questions.filter((q) => q.id !== questionId).map((q) => q.id),
    );
    await this.redistribute(id, quiz.totalScore);
    return this.toDetail(await this.load(id), teacherId);
  }

  async reorder(
    id: string,
    teacherId: string,
    questionIds: string[],
  ): Promise<QuizDetail> {
    const quiz = await this.loadOwned(id, teacherId);
    await this.assertStructureEditable(id);
    if (
      new Set(questionIds).size !== quiz.questions.length ||
      quiz.questions.some((q) => !questionIds.includes(q.id))
    ) {
      throw new BadRequestException('Danh sách thứ tự câu hỏi không đầy đủ');
    }
    await this.reorderRows(id, questionIds);
    await this.redistribute(id, quiz.totalScore);
    return this.toDetail(await this.load(id), teacherId);
  }

  async addAssignment(id: string, teacherId: string, dto: CreateAssignmentDto) {
    const quiz = await this.loadOwned(id, teacherId);
    const validTarget =
      (quiz.visibility === QuizVisibility.PRIVATE_CLASS &&
        dto.targetType === QuizAssignmentTargetType.CLASSROOM) ||
      (quiz.visibility === QuizVisibility.ASSIGNED &&
        dto.targetType === QuizAssignmentTargetType.STUDENT);
    if (!validTarget) {
      throw new BadRequestException('Đối tượng gán không phù hợp phạm vi quiz');
    }
    if (dto.targetType === QuizAssignmentTargetType.CLASSROOM) {
      const classroom = await this.classrooms.findOne({
        where: { id: dto.targetId, teacherId },
      });
      if (!classroom)
        throw new ForbiddenException('Bạn không sở hữu lớp học này');
    } else {
      const student = await this.users.findOne({ where: { id: dto.targetId } });
      if (!student || student.role !== UserRole.STUDENT)
        throw new BadRequestException('Học sinh không tồn tại');
    }
    const where =
      dto.targetType === QuizAssignmentTargetType.CLASSROOM
        ? { quizId: id, classroomId: dto.targetId }
        : { quizId: id, studentId: dto.targetId };
    let assignment = await this.assignments.findOne({ where });
    assignment ??= this.assignments.create({
      quizId: id,
      targetType: dto.targetType,
      classroomId:
        dto.targetType === QuizAssignmentTargetType.CLASSROOM
          ? dto.targetId
          : null,
      studentId:
        dto.targetType === QuizAssignmentTargetType.STUDENT
          ? dto.targetId
          : null,
      assignedBy: teacherId,
    });
    await this.assignments.save(assignment);
    return this.toDetail(await this.load(id), teacherId).assignments;
  }

  async deleteAssignment(
    id: string,
    assignmentId: string,
    teacherId: string,
  ): Promise<void> {
    await this.loadOwned(id, teacherId);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId, quizId: id },
    });
    if (!assignment) throw new NotFoundException('Phân phối không tồn tại');
    await this.assignments.remove(assignment);
  }

  async regrade(
    id: string,
    teacherId: string,
  ): Promise<{ regradedAttempts: number }> {
    const quiz = await this.loadOwned(id, teacherId);
    const submitted = await this.attempts.find({
      where: { quizId: id, status: QuizAttemptStatus.SUBMITTED },
      relations: { answers: true },
    });
    for (const attempt of submitted) {
      let total = 0;
      for (const answer of attempt.answers) {
        const question = quiz.questions.find(
          (item) => item.id === answer.questionId,
        );
        if (!question) continue;
        const graded = gradeAnswer(question, answer.selectedOptionIds);
        answer.isCorrect = graded.isCorrect;
        answer.scoreAwarded = graded.scoreAwarded.toFixed(2);
        total += graded.scoreAwarded;
      }
      await this.answers.save(attempt.answers);
      attempt.score = total.toFixed(2);
      await this.attempts.save(attempt);
    }
    quiz.lastRegradedAt = new Date();
    quiz.answersChangedAt = null;
    await this.quizzes.save(quiz);
    return { regradedAttempts: submitted.length };
  }

  async results(id: string, teacherId: string): Promise<QuizResultRow[]> {
    await this.loadOwned(id, teacherId);
    const attempts = await this.attempts.find({
      where: { quizId: id, status: QuizAttemptStatus.SUBMITTED },
      relations: { user: true },
    });
    attempts.sort(compareAttemptsForRanking);
    return attempts.map((attempt, index) => ({
      rank: index + 1,
      attemptId: attempt.id,
      identityName: attempt.user?.fullName ?? attempt.guestName ?? 'Khách',
      label: attempt.user?.fullName ?? attempt.guestName ?? 'Khách',
      score: Number(attempt.score),
      maxScore: Number(attempt.maxScore),
      timeTakenSeconds: attempt.timeTakenSeconds ?? 0,
      submittedAt: attempt.submittedAt?.toISOString() ?? '',
      attemptNumber: attempt.attemptNumber,
    }));
  }

  async assertCanView(
    quiz: Quiz,
    currentUser: AuthenticatedUser | null,
  ): Promise<void> {
    if (
      quiz.teacherId === currentUser?.id ||
      quiz.visibility === QuizVisibility.PUBLIC
    )
      return;
    if (!currentUser)
      throw new ForbiddenException('Bạn không có quyền xem quiz này');
    if (
      quiz.visibility === QuizVisibility.ASSIGNED &&
      quiz.assignments.some((a) => a.studentId === currentUser.id)
    )
      return;
    if (quiz.visibility === QuizVisibility.PRIVATE_CLASS) {
      const classroomIds = quiz.assignments
        .map((a) => a.classroomId)
        .filter((id): id is string => !!id);
      if (
        classroomIds.length &&
        (await this.members
          .createQueryBuilder('member')
          .where('member.user_id = :userId', { userId: currentUser.id })
          .andWhere('member.classroom_id IN (:...classroomIds)', {
            classroomIds,
          })
          .getExists())
      )
        return;
    }
    throw new ForbiddenException('Bạn không có quyền xem quiz này');
  }

  async load(id: string): Promise<Quiz> {
    const quiz = await this.quizzes.findOne({
      where: { id },
      relations: {
        teacher: true,
        questions: { options: true },
        assignments: { classroom: true, student: true },
      },
      order: {
        questions: { displayOrder: 'ASC', options: { displayOrder: 'ASC' } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz không tồn tại');
    return quiz;
  }
  private async loadOwned(id: string, teacherId: string): Promise<Quiz> {
    const quiz = await this.load(id);
    if (quiz.teacherId !== teacherId)
      throw new ForbiddenException('Bạn không có quyền quản lý quiz này');
    return quiz;
  }
  private async assertStructureEditable(id: string) {
    if (await this.attempts.exists({ where: { quizId: id } }))
      throw new ConflictException('Không thể đổi cấu trúc quiz đã có lượt làm');
  }
  private async redistribute(id: string, total: number) {
    const questions = await this.questions.find({
      where: { quizId: id },
      order: { displayOrder: 'ASC' },
    });
    const scores = redistributeScores(total, questions.length);
    await Promise.all(
      questions.map((question, index) =>
        this.questions.update(question.id, { score: scores[index].toFixed(2) }),
      ),
    );
  }
  private async reorderRows(id: string, ids: string[]) {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(QuizQuestion)
        .set({ displayOrder: () => 'display_order + 100000' })
        .where('quiz_id = :id', { id })
        .execute();
      for (const [index, questionId] of ids.entries())
        await manager.update(
          QuizQuestion,
          { id: questionId, quizId: id },
          { displayOrder: index },
        );
    });
  }
  private toSummary(quiz: Quiz): QuizSummary {
    return {
      id: quiz.id,
      teacherId: quiz.teacherId,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
      visibility: quiz.visibility,
      questionCount: quiz.questions?.length ?? 0,
      totalScore: quiz.totalScore,
      dueAt: quiz.dueAt?.toISOString() ?? null,
      createdAt: quiz.createdAt.toISOString(),
      updatedAt: quiz.updatedAt.toISOString(),
    };
  }
  private toDetail(quiz: Quiz, viewerId: string | null): QuizDetail {
    const isOwner = quiz.teacherId === viewerId;
    return {
      ...this.toSummary(quiz),
      timeLimitSeconds: quiz.timeLimitSeconds,
      opensAt: quiz.opensAt?.toISOString() ?? null,
      maxAttempts: quiz.maxAttempts,
      leaderboardMode: quiz.leaderboardMode,
      answersChangedAt: quiz.answersChangedAt?.toISOString() ?? null,
      lastRegradedAt: quiz.lastRegradedAt?.toISOString() ?? null,
      isOwner,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        explanation: isOwner ? q.explanation : null,
        showExplanation: isOwner ? q.showExplanation : false,
        score: Number(q.score),
        displayOrder: q.displayOrder,
        options: q.options.map((o) => ({
          id: o.id,
          content: o.content,
          isCorrect: isOwner ? o.isCorrect : false,
          displayOrder: o.displayOrder,
        })),
      })),
      assignments: isOwner
        ? quiz.assignments.map((a) => ({
            id: a.id,
            targetType: a.targetType,
            classroomId: a.classroomId,
            studentId: a.studentId,
            targetName:
              a.classroom?.name ?? a.student?.fullName ?? 'Không xác định',
            createdAt: a.createdAt.toISOString(),
          }))
        : [],
    };
  }
}

function validateQuestion(question: QuizQuestion): void {
  if (question.options.length < 2)
    throw new BadRequestException(
      `Câu ${question.displayOrder + 1} cần ít nhất 2 lựa chọn`,
    );
  const correct = question.options.filter((option) => option.isCorrect).length;
  if (
    question.type === QuizQuestionType.MULTIPLE_CHOICE
      ? correct < 1
      : correct !== 1
  )
    throw new BadRequestException(
      `Câu ${question.displayOrder + 1} có đáp án đúng không hợp lệ`,
    );
  if (
    question.type === QuizQuestionType.TRUE_FALSE &&
    question.options.length !== 2
  )
    throw new BadRequestException(
      `Câu ${question.displayOrder + 1} phải có đúng 2 lựa chọn`,
    );
}
