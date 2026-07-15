import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '@/modules/mail/mail.module';
import { Quiz } from '@/modules/quiz/entities/quiz.entity';
import { QuizAttempt } from '@/modules/quiz/entities/quiz-attempt.entity';
import { User } from '@/modules/user/entities/user.entity';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import { AiBudgetNotificationService } from './ai-budget-notification.service';
import { NotificationQueueService } from './notification-queue.service';
import { QuizNotificationService } from './quiz-notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationOutboxEntity,
      Quiz,
      QuizAttempt,
      User,
    ]),
    MailModule,
  ],
  providers: [
    NotificationQueueService,
    QuizNotificationService,
    AiBudgetNotificationService,
  ],
  controllers: [NotificationController],
  exports: [AiBudgetNotificationService],
})
export class NotificationModule {}
