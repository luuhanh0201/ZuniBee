import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserRole } from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { QuizWeaknessInsightService } from './quiz-weakness-insight.service';
import { ExpensiveOperationRateLimit } from '@/common/security/rate-limit.decorator';

@Roles(UserRole.TEACHER)
@Controller('quizzes/:quizId/ai-insight')
export class QuizInsightController {
  constructor(private readonly service: QuizWeaknessInsightService) {}
  @Get()
  latest(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.latest(quizId, user.id);
  }
  @Post()
  @ExpensiveOperationRateLimit()
  generate(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.generate(quizId, user.id);
  }
}
