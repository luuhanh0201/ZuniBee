import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MailTemplateRenderer } from '@/modules/mail/mail-template.renderer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(
    private readonly config: ConfigService,
    private readonly templateRenderer: MailTemplateRenderer,
  ) {
    this.fromAddress = this.config.get<string>(
      'MAIL_FROM',
      'ZuniBee <no-reply@zunibee.app>',
    );

    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASSWORD', ''),
      },
    });
  }

  async sendTempPassword(
    email: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    const expiresLabel = formatDurationVi(
      this.config.getOrThrow<string>('PASSWORD_RESET_EXPIRES_IN'),
    );
    const loginUrl =
      this.config.get<string>('WEB_URL', 'http://localhost:1111') + '/login';
    const templateContext = {
      title: 'Mật khẩu tạm thời — ZuniBee',
      preheader: 'Mật khẩu tạm thời để khôi phục tài khoản ZuniBee của bạn.',
      fullName,
      tempPassword,
      expiresLabel,
      loginUrl,
    };
    const [html, text] = await Promise.all([
      this.templateRenderer.renderHtml('temp-password', templateContext),
      this.templateRenderer.renderText('temp-password', templateContext),
    ]);

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Mật khẩu tạm thời — ZuniBee',
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        'Gửi email mật khẩu tạm tới ' + email + ' thất bại',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}

function formatDurationVi(duration: string): string {
  const match = /^(\d+)\s*(m|h|d)$/.exec(duration.trim());
  if (!match) return duration;

  const unit: Record<string, string> = {
    m: 'phút',
    h: 'giờ',
    d: 'ngày',
  };
  return match[1] + ' ' + unit[match[2]];
}
