import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '@/modules/mail/mail.module';
import { Quiz } from '@/modules/quiz/entities/quiz.entity';
import { QuizAttempt } from '@/modules/quiz/entities/quiz-attempt.entity';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import { NotificationQueueService } from './notification-queue.service';
import { QuizNotificationService } from './quiz-notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOutboxEntity, Quiz, QuizAttempt]),
    MailModule,
  ],
  providers: [NotificationQueueService, QuizNotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
