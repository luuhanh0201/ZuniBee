import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MailTemplateRenderer } from '@/modules/mail/mail-template.renderer';

export type ClassroomInvitationMail = {
  email: string;
  teacherName: string;
  classroomName: string;
  invitationUrl: string;
  expiresAt: Date;
};

export type ClassroomMemberAddedMail = {
  email: string;
  studentName: string;
  teacherName: string;
  classroomName: string;
  classroomUrl: string;
};

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

  async sendClassroomInvitation(input: ClassroomInvitationMail): Promise<void> {
    const templateContext = {
      title: `Lời mời vào lớp ${input.classroomName} — ZuniBee`,
      preheader: `${input.teacherName} đã mời bạn tham gia lớp ${input.classroomName}.`,
      teacherName: input.teacherName,
      classroomName: input.classroomName,
      invitationUrl: input.invitationUrl,
      expiresLabel: formatDateTimeVi(input.expiresAt),
    };
    const [html, text] = await Promise.all([
      this.templateRenderer.renderHtml('classroom-invitation', templateContext),
      this.templateRenderer.renderText('classroom-invitation', templateContext),
    ]);

    await this.sendMail({
      to: input.email,
      subject: `Lời mời vào lớp ${input.classroomName} — ZuniBee`,
      html,
      text,
      errorLabel: 'lời mời lớp học',
    });
  }

  async sendClassroomMemberAdded(
    input: ClassroomMemberAddedMail,
  ): Promise<void> {
    const templateContext = {
      title: `Bạn đã được thêm vào lớp ${input.classroomName} — ZuniBee`,
      preheader: `${input.teacherName} đã thêm bạn vào lớp ${input.classroomName}.`,
      studentName: input.studentName,
      teacherName: input.teacherName,
      classroomName: input.classroomName,
      classroomUrl: input.classroomUrl,
    };
    const [html, text] = await Promise.all([
      this.templateRenderer.renderHtml(
        'classroom-member-added',
        templateContext,
      ),
      this.templateRenderer.renderText(
        'classroom-member-added',
        templateContext,
      ),
    ]);

    await this.sendMail({
      to: input.email,
      subject: `Bạn đã được thêm vào lớp ${input.classroomName} — ZuniBee`,
      html,
      text,
      errorLabel: 'thông báo tham gia lớp học',
    });
  }

  private async sendMail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    errorLabel: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
    } catch (error) {
      this.logger.error(
        `Gửi ${input.errorLabel} tới ${input.to} thất bại`,
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

function formatDateTimeVi(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}
