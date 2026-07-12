import { MailTemplateRenderer } from '@/modules/mail/mail-template.renderer';

describe('MailTemplateRenderer', () => {
  const renderer = new MailTemplateRenderer();
  const context = {
    title: 'Mật khẩu tạm thời — ZuniBee',
    preheader: 'Khôi phục tài khoản ZuniBee',
    fullName: '<Hạnh Đinh>',
    tempPassword: 'Abc<123>',
    expiresLabel: '15 phút',
    loginUrl: 'http://localhost:1111/login',
  };

  it('renders the branded HTML layout and escapes dynamic content', async () => {
    const html = await renderer.renderHtml('temp-password', context);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain("Zuni<span style='color:#2563eb;'>Bee</span>");
    expect(html).toContain('&lt;Hạnh Đinh&gt;');
    expect(html).toContain('Abc&lt;123&gt;');
    expect(html).not.toContain('Xin chào <Hạnh Đinh>');
  });

  it('renders a plain-text fallback from Handlebars', async () => {
    const text = await renderer.renderText('temp-password', context);

    expect(text).toContain('Xin chào <Hạnh Đinh>');
    expect(text).toContain('Thời hạn sử dụng: 15 phút.');
  });

  it('renders classroom invitation templates and escapes classroom data', async () => {
    const invitationContext = {
      title: 'Lời mời lớp học',
      preheader: 'Bạn có lời mời mới',
      teacherName: '<Cô Bee>',
      classroomName: 'Toán <10A1>',
      invitationUrl: 'http://localhost:1111/join/token?type=invitation',
      expiresLabel: '19:00 ngày 19 tháng 7 năm 2026',
    };

    const [html, text] = await Promise.all([
      renderer.renderHtml('classroom-invitation', invitationContext),
      renderer.renderText('classroom-invitation', invitationContext),
    ]);

    expect(html).toContain('&lt;Cô Bee&gt;');
    expect(html).toContain('Toán &lt;10A1&gt;');
    expect(text).toContain('Toán <10A1>');
    expect(text).toContain('?type=invitation');
  });
});
