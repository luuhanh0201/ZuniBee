import { Module } from '@nestjs/common';
import { MailService } from '@/modules/mail/mail.service';
import { MailTemplateRenderer } from '@/modules/mail/mail-template.renderer';

@Module({
  providers: [MailService, MailTemplateRenderer],
  exports: [MailService],
})
export class MailModule {}
