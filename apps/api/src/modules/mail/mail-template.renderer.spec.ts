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
});
