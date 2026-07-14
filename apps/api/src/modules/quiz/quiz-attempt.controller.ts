import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@zunibee/shared';
import { OptionalAuth } from '@/common/decorators/optional-auth.decorator';
import { OptionalCurrentUser } from '@/common/decorators/optional-current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { QuizAttemptService } from './quiz-attempt.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { GuestAttemptRateLimit } from '@/common/security/rate-limit.decorator';

@Controller('quiz-attempts')
export class QuizAttemptController {
  constructor(private readonly service: QuizAttemptService) {}
  @OptionalAuth() @Post() @GuestAttemptRateLimit() start(
    @Body() dto: StartAttemptDto,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.service.start(dto, user);
  }
  @Roles(UserRole.STUDENT) @Get('mine') mine(
    @Query('quizId', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.mine(quizId, user.id);
  }
  @OptionalAuth() @Get('quiz/:quizId/leaderboard') leaderboard(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.service.leaderboard(quizId, user);
  }
  @OptionalAuth() @Get(':id') get(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.service.get(id, user, guestToken);
  }
  @OptionalAuth() @Patch(':id/answers/:questionId') saveAnswer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SaveAnswerDto,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.service.saveAnswer(id, questionId, dto, user, guestToken);
  }
  @OptionalAuth() @Post(':id/submit') submit(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.service.submit(id, user, guestToken);
  }
  @OptionalAuth() @Get(':id/result') result(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.service.result(id, user, guestToken);
  }
}
