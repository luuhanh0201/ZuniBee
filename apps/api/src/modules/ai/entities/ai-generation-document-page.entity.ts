import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { AiGenerationPageFailureCategory } from '@zunibee/shared';

export enum AiDocumentPageExtractionMethod {
  DIRECT_TEXT = 'direct_text',
  TEXT_LAYER = 'text_layer',
  LOCAL_OCR = 'local_ocr',
  AI_PDF = 'ai_pdf',
  AI_VISION = 'ai_vision',
}

@Entity('ai_generation_document_pages')
@Index('IDX_ai_generation_document_pages_job', ['jobId'])
export class AiGenerationDocumentPageEntity {
  @PrimaryColumn({ name: 'job_id', type: 'uuid' }) jobId!: string;
  @PrimaryColumn({ name: 'page_number', type: 'integer' }) pageNumber!: number;
  @Column({ type: 'text' }) text!: string;
  @Column({
    name: 'extraction_method',
    type: 'varchar',
    length: 20,
  })
  extractionMethod!: AiDocumentPageExtractionMethod;
  @Column({ type: 'real', nullable: true }) confidence!: number | null;
  @Column({ name: 'vision_input_tokens', type: 'integer', default: 0 })
  visionInputTokens!: number;
  @Column({ name: 'vision_output_tokens', type: 'integer', default: 0 })
  visionOutputTokens!: number;
  @Column({
    name: 'failure_category',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  failureCategory!: AiGenerationPageFailureCategory | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
