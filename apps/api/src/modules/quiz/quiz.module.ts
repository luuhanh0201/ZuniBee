import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizQuestionOption } from './entities/quiz-question-option.entity';
import { QuizAssignment } from './entities/quiz-assignment.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from './entities/quiz-attempt-answer.entity';
import { QuizService } from './quiz.service';
import { QuizAttemptService } from './quiz-attempt.service';
import { QuizController } from './quiz.controller';
import { QuizAttemptController } from './quiz-attempt.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizQuestion,
      QuizQuestionOption,
      QuizAssignment,
      QuizAttempt,
      QuizAttemptAnswer,
      User,
      Classroom,
      ClassroomMember,
    ]),
  ],
  controllers: [QuizController, QuizAttemptController],
  providers: [QuizService, QuizAttemptService],
  exports: [QuizService],
})
export class QuizModule {}
