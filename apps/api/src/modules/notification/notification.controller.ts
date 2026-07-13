import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserRole } from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { QuizNotificationService } from './quiz-notification.service';

@Roles(UserRole.TEACHER)
@Controller('quizzes/:quizId/notifications')
export class NotificationController {
  constructor(private readonly service: QuizNotificationService) {}
  @Post('results') enqueue(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.enqueueResults(quizId, user.id);
  }
  @Get('results') list(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(quizId, user.id);
  }
}
