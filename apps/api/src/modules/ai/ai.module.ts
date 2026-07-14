import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { Quiz } from '@/modules/quiz/entities/quiz.entity';
import { QuizAttempt } from '@/modules/quiz/entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from '@/modules/quiz/entities/quiz-attempt-answer.entity';
import { User } from '@/modules/user/entities/user.entity';
import { AiProviderEntity } from './entities/ai-provider.entity';
import { AiCreditAccountEntity } from './entities/ai-credit-account.entity';
import { AiCreditLedgerEntity } from './entities/ai-credit-ledger.entity';
import { AiGenerationJobEntity } from './entities/ai-generation-job.entity';
import { AiUsageEventEntity } from './entities/ai-usage-event.entity';
import { QuizWeaknessInsightEntity } from './entities/quiz-weakness-insight.entity';
import { AiSecretService } from './ai-secret.service';
import { AiProviderService } from './ai-provider.service';
import { AiCreditService } from './ai-credit.service';
import { AiModelClientService } from './ai-model-client.service';
import { AiUsageService } from './ai-usage.service';
import { AiMaterialSourceService } from './ai-material-source.service';
import { AiQuizGenerationService } from './ai-quiz-generation.service';
import { AiController } from './ai.controller';
import { AdminAiController } from './admin-ai.controller';
import { QuizWeaknessInsightService } from './quiz-weakness-insight.service';
import { QuizInsightController } from './quiz-insight.controller';
import { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiProviderEntity,
      AiCreditAccountEntity,
      AiCreditLedgerEntity,
      AiGenerationJobEntity,
      AiUsageEventEntity,
      QuizWeaknessInsightEntity,
      User,
      Quiz,
      QuizAttempt,
      QuizAttemptAnswer,
    ]),
    QuizModule,
  ],
  controllers: [AiController, AdminAiController, QuizInsightController],
  providers: [
    AiSecretService,
    AiProviderService,
    AiCreditService,
    AiModelClientService,
    AiUsageService,
    AiProviderUrlPolicyService,
    AiMaterialSourceService,
    AiQuizGenerationService,
    QuizWeaknessInsightService,
  ],
  exports: [AiProviderService, AiCreditService, AiModelClientService],
})
export class AiModule {}
