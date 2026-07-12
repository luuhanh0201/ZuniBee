import { Injectable } from '@nestjs/common';
import Handlebars, { type TemplateDelegate } from 'handlebars';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type MailTemplateName =
  'temp-password' | 'classroom-invitation' | 'classroom-member-added';
export type MailTemplateContext = Record<string, unknown>;

@Injectable()
export class MailTemplateRenderer {
  private readonly compiledTemplates = new Map<string, TemplateDelegate>();

  async renderHtml(
    templateName: MailTemplateName,
    context: MailTemplateContext,
  ): Promise<string> {
    const [contentTemplate, layoutTemplate] = await Promise.all([
      this.getTemplate(`${templateName}.hbs`),
      this.getTemplate('layouts/main.hbs'),
    ]);
    const body = contentTemplate(context);

    return layoutTemplate({
      ...context,
      body,
      currentYear: new Date().getFullYear(),
    });
  }

  async renderText(
    templateName: MailTemplateName,
    context: MailTemplateContext,
  ): Promise<string> {
    const template = await this.getTemplate(`${templateName}.text.hbs`, true);
    return template(context);
  }

  private async getTemplate(
    relativePath: string,
    noEscape = false,
  ): Promise<TemplateDelegate> {
    const cacheKey = `${relativePath}:${noEscape ? 'plain' : 'html'}`;
    const cachedTemplate = this.compiledTemplates.get(cacheKey);
    if (cachedTemplate) return cachedTemplate;

    const source = await readFile(
      join(__dirname, 'templates', relativePath),
      'utf8',
    );
    const compiledTemplate = Handlebars.compile(source, { noEscape });
    this.compiledTemplates.set(cacheKey, compiledTemplate);

    return compiledTemplate;
  }
}
