import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { AiCreditService } from './ai-credit.service';
import { AiQuizGenerationService } from './ai-quiz-generation.service';
import { GenerateQuizWithAiDto } from './dto/generate-quiz-with-ai.dto';
import { MAX_AI_SOURCE_SIZE } from './ai-material-source.service';
import { ExpensiveOperationRateLimit } from '@/common/security/rate-limit.decorator';

@Roles(UserRole.TEACHER)
@Controller('ai')
export class AiController {
  constructor(
    private readonly credits: AiCreditService,
    private readonly generation: AiQuizGenerationService,
  ) {}
  @Get('credits/me') creditsMe(@CurrentUser() user: AuthenticatedUser) {
    return this.credits.get(user.id);
  }
  @Get('credits/history') creditHistory(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.credits.history(user.id);
  }
  @Post('quiz-generations')
  @ExpensiveOperationRateLimit()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'topic', 'questionCount'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        topic: { type: 'string' },
        language: { type: 'string' },
        difficulty: { enum: ['easy', 'medium', 'hard'] },
        questionCount: { type: 'integer' },
        questionTypes: { type: 'string', description: 'JSON array' },
        sourceType: { enum: ['prompt', 'upload'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AI_SOURCE_SIZE } }),
  )
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateQuizWithAiDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.generation.generate(user.id, dto, file);
  }
  @Get('quiz-generations/:id') generationJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.generation.get(id, user.id);
  }
}
