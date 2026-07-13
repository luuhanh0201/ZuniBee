import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  UserRole,
  type QuizAssignment,
  type QuizDetail,
  type QuizResultRow,
  type QuizSummary,
} from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { OptionalAuth } from '@/common/decorators/optional-auth.decorator';
import { OptionalCurrentUser } from '@/common/decorators/optional-current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { ConfigureQuizDto } from './dto/configure-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly service: QuizService) {}
  @Roles(UserRole.TEACHER) @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizDto,
  ): Promise<QuizDetail> {
    return this.service.create(user.id, dto);
  }
  @Roles(UserRole.TEACHER) @Get() list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizSummary[]> {
    return this.service.listMine(user.id);
  }
  @OptionalAuth() @Get(':id') get(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentUser() user: AuthenticatedUser | null,
  ): Promise<QuizDetail> {
    return this.service.get(id, user);
  }
  @Roles(UserRole.TEACHER) @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.service.update(id, user.id, dto);
  }
  @Roles(UserRole.TEACHER) @Patch(':id/configure') configure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureQuizDto,
  ) {
    return this.service.configure(id, user.id, dto);
  }
  @Roles(UserRole.TEACHER) @Post(':id/publish') publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publish(id, user.id);
  }
  @Roles(UserRole.TEACHER) @Post(':id/unpublish') unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.unpublish(id, user.id);
  }
  @Roles(UserRole.TEACHER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.id);
  }
  @Roles(UserRole.TEACHER) @Get(':id/questions') async questions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return (await this.service.get(id, user)).questions;
  }
  @Roles(UserRole.TEACHER) @Post(':id/questions') addQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.service.addQuestion(id, user.id, dto);
  }
  @Roles(UserRole.TEACHER) @Patch(':id/questions/reorder') reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.service.reorder(id, user.id, dto.questionIds);
  }
  @Roles(UserRole.TEACHER) @Patch(':id/questions/:questionId') updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.updateQuestion(id, questionId, user.id, dto);
  }
  @Roles(UserRole.TEACHER) @Delete(':id/questions/:questionId') deleteQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteQuestion(id, questionId, user.id);
  }
  @Roles(UserRole.TEACHER) @Get(':id/assignments') async assignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizAssignment[]> {
    return (await this.service.get(id, user)).assignments;
  }
  @Roles(UserRole.TEACHER) @Post(':id/assignments') addAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.service.addAssignment(id, user.id, dto);
  }
  @Roles(UserRole.TEACHER)
  @Delete(':id/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteAssignment(id, assignmentId, user.id);
  }
  @Roles(UserRole.TEACHER) @Post(':id/regrade') regrade(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.regrade(id, user.id);
  }
  @Roles(UserRole.TEACHER) @Get(':id/results') results(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizResultRow[]> {
    return this.service.results(id, user.id);
  }
}
