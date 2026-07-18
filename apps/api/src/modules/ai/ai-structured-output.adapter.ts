import type { AiProviderEntity } from './entities/ai-provider.entity';
import { AiProviderDriver, providerDriverFor } from './ai-provider-driver';

export type AiJsonSchema = Record<string, unknown>;

/**
 * Chế độ structured output theo khả năng thật của từng provider/model:
 * - strict_schema: provider nhận JSON schema (đã biên dịch về tập keyword
 *   được hỗ trợ) và tự ép cấu trúc đầu ra.
 * - json_object: provider chỉ đảm bảo trả JSON object; cấu trúc phải mô tả
 *   trong prompt.
 * - prompt_json: provider không có response_format; toàn bộ yêu cầu JSON nằm
 *   trong prompt.
 */
export type AiStructuredOutputMode =
  'strict_schema' | 'json_object' | 'prompt_json';

export type AiStructuredOutputPlan = {
  mode: AiStructuredOutputMode;
  /** Schema gửi provider (đã biên dịch); null khi mode không gửi schema. */
  schema: AiJsonSchema | null;
  /** Đoạn nhắc cấu trúc nối vào prompt khi provider không nhận schema. */
  promptInstruction: string | null;
};

/**
 * Keyword JSON Schema mà mọi provider strict-schema (Anthropic structured
 * output, OpenAI strict mode...) đều chấp nhận. Các ràng buộc số lượng/độ dài
 * (minimum, maxItems, uniqueItems...) KHÔNG nằm trong tập này: chúng bị loại
 * khỏi schema gửi đi, được diễn giải vào description cho model đọc và luôn
 * được kiểm tra lại bằng canonical schema sau khi AI trả kết quả.
 */
const STRICT_SUPPORTED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'const',
  'description',
  'title',
  'additionalProperties',
  'anyOf',
  '$defs',
  '$ref',
  'default',
]);

/**
 * Chọn chế độ structured output theo provider + model. Capability phải xét
 * theo model vì các model cùng provider hỗ trợ khác nhau (ví dụ Groq chỉ có
 * gpt-oss hỗ trợ strict schema).
 */
export function resolveStructuredOutput(
  provider: AiProviderEntity,
  canonicalSchema: AiJsonSchema,
): AiStructuredOutputPlan {
  const mode = resolveStructuredOutputMode(provider);
  if (mode === 'strict_schema')
    return {
      mode,
      // Ollama chuyển schema thành grammar và bỏ qua keyword lạ nên giữ
      // nguyên canonical schema; các provider HTTP strict sẽ trả 400 với
      // keyword ngoài tập hỗ trợ nên phải biên dịch.
      schema:
        providerDriverFor(provider) === AiProviderDriver.OLLAMA
          ? canonicalSchema
          : compileStrictSchema(canonicalSchema),
      promptInstruction: null,
    };
  return {
    mode,
    schema: null,
    promptInstruction: schemaPromptInstruction(canonicalSchema),
  };
}

export function resolveStructuredOutputMode(
  provider: AiProviderEntity,
): AiStructuredOutputMode {
  const driver = providerDriverFor(provider);
  if (driver === AiProviderDriver.OLLAMA) return 'strict_schema';
  const model = provider.model.toLowerCase();
  if (
    driver === AiProviderDriver.ANTHROPIC ||
    driver === AiProviderDriver.OPENAI ||
    driver === AiProviderDriver.GEMINI ||
    driver === AiProviderDriver.OPENROUTER
  )
    return 'strict_schema';
  if (driver === AiProviderDriver.GROQ)
    return model.startsWith('openai/gpt-oss-')
      ? 'strict_schema'
      : 'json_object';
  // DeepSeek và các OpenAI-compatible chưa biết rõ chỉ tin được json_object.
  return 'json_object';
}

/**
 * Provider nhận PDF trong message (không cần render từng trang tại ZuniBee):
 * Anthropic qua content block "document", OpenAI/OpenRouter qua content part
 * "file". OpenRouter tự dùng native file input khi model hỗ trợ và file-parser
 * khi không hỗ trợ. Gemini direct dùng generateContent + inlineData PDF;
 * Ollama vẫn dùng fallback ảnh.
 */
export function supportsPdfNativeInput(provider: AiProviderEntity): boolean {
  const driver = providerDriverFor(provider);
  return (
    driver === AiProviderDriver.ANTHROPIC ||
    driver === AiProviderDriver.OPENAI ||
    (driver === AiProviderDriver.GEMINI &&
      provider.model.toLowerCase().startsWith('gemini-')) ||
    driver === AiProviderDriver.OPENROUTER
  );
}

/**
 * Biên dịch canonical schema về tập keyword strict được hỗ trợ. Ràng buộc bị
 * loại được diễn giải tiếng Việt vào description để model vẫn biết yêu cầu.
 */
export function compileStrictSchema(schema: AiJsonSchema): AiJsonSchema {
  const compiled: AiJsonSchema = {};
  const constraintNotes = describeDroppedConstraints(schema);
  for (const [key, value] of Object.entries(schema)) {
    if (!STRICT_SUPPORTED_KEYWORDS.has(key)) continue;
    if (key === 'properties' || key === '$defs') {
      compiled[key] = Object.fromEntries(
        Object.entries(value as Record<string, AiJsonSchema>).map(
          ([name, child]) => [name, compileStrictSchema(child)],
        ),
      );
    } else if (key === 'items') {
      compiled[key] = compileStrictSchema(value as AiJsonSchema);
    } else if (key === 'anyOf') {
      compiled[key] = (value as AiJsonSchema[]).map((child) =>
        compileStrictSchema(child),
      );
    } else {
      compiled[key] = value;
    }
  }
  if (constraintNotes.length) {
    const description =
      typeof compiled.description === 'string' ? compiled.description : '';
    compiled.description = [description, `(${constraintNotes.join('; ')})`]
      .filter(Boolean)
      .join(' ');
  }
  return compiled;
}

function describeDroppedConstraints(schema: AiJsonSchema): string[] {
  const notes: string[] = [];
  const numeric = (key: string): number | null =>
    typeof schema[key] === 'number' ? schema[key] : null;
  const minimum = numeric('minimum');
  const maximum = numeric('maximum');
  if (minimum !== null && maximum !== null)
    notes.push(`giá trị từ ${minimum} đến ${maximum}`);
  else if (minimum !== null) notes.push(`giá trị tối thiểu ${minimum}`);
  else if (maximum !== null) notes.push(`giá trị tối đa ${maximum}`);
  const minItems = numeric('minItems');
  const maxItems = numeric('maxItems');
  if (minItems !== null && maxItems !== null)
    notes.push(
      minItems === maxItems
        ? `mảng phải có đúng ${minItems} phần tử`
        : `mảng có từ ${minItems} đến ${maxItems} phần tử`,
    );
  else if (minItems !== null)
    notes.push(`mảng có tối thiểu ${minItems} phần tử`);
  else if (maxItems !== null) notes.push(`mảng có tối đa ${maxItems} phần tử`);
  if (schema.uniqueItems === true)
    notes.push('các phần tử không được trùng lặp');
  const minLength = numeric('minLength');
  const maxLength = numeric('maxLength');
  if (minLength !== null && maxLength !== null)
    notes.push(`chuỗi dài từ ${minLength} đến ${maxLength} ký tự`);
  else if (minLength !== null)
    notes.push(`chuỗi dài tối thiểu ${minLength} ký tự`);
  else if (maxLength !== null)
    notes.push(`chuỗi dài tối đa ${maxLength} ký tự`);
  return notes;
}

/**
 * Nhắc cấu trúc cho chế độ json_object/prompt_json: nhúng canonical schema
 * (giữ nguyên mọi ràng buộc — với model đây chỉ là văn bản hướng dẫn).
 */
export function schemaPromptInstruction(schema: AiJsonSchema): string {
  return `\n\nKết quả bắt buộc là MỘT JSON object hợp lệ đúng theo JSON Schema sau (đúng tên field, đủ field required, không thêm field lạ, không markdown):\n${JSON.stringify(schema)}`;
}
