import type { AiProviderKind } from "@zunibee/shared";

export type AiProviderPresetId =
  | "openai"
  | "anthropic"
  | "google_gemini"
  | "deepseek"
  | "groq"
  | "openrouter"
  | "ollama"
  | "custom";

/** Đánh giá tương đối giữa các model trong cùng một provider. */
export type AiModelStrength = "strong" | "medium" | "weak";

/** Đơn giá USD trên 1 triệu token, tách chiều input/output. */
export type AiModelReferencePricing = {
  inputUsdPer1m: number;
  outputUsdPer1m: number;
};

export type AiProviderPreset = {
  id: AiProviderPresetId;
  label: string;
  kind: AiProviderKind;
  baseUrl: string;
  suggestedModels: string[];
  /** Note sức mạnh hiển thị cạnh model; model discover động sẽ không có note. */
  modelStrengths?: Record<string, AiModelStrength>;
  /**
   * Giá tham khảo theo bảng giá công bố của provider (07/2026) — chỉ để
   * prefill, admin cần đối chiếu lại. OpenRouter không cần vì lấy giá qua API.
   */
  referencePricing?: Record<string, AiModelReferencePricing>;
  apiKeyRequired: boolean;
};

// 5 provider nổi tiếng phù hợp nhất với ZuniBee (sinh quiz JSON, chi phí thấp,
// hỗ trợ tiếng Việt tốt), xếp model đề xuất mặc định (rẻ + đủ mạnh) lên đầu.
// Danh sách model cập nhật theo docs chính thức của từng provider (07/2026).
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "google_gemini",
    label: "Google Gemini",
    kind: "openai_compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    suggestedModels: [
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
    modelStrengths: {
      "gemini-3.5-flash": "strong",
      "gemini-3.1-pro-preview": "strong",
      "gemini-3-flash-preview": "medium",
      "gemini-3.1-flash-lite": "medium",
      "gemini-2.5-pro": "medium",
      "gemini-2.5-flash": "medium",
      "gemini-2.5-flash-lite": "weak",
    },
    referencePricing: {
      "gemini-3.5-flash": { inputUsdPer1m: 1.5, outputUsdPer1m: 9 },
      "gemini-3.1-pro-preview": { inputUsdPer1m: 2, outputUsdPer1m: 12 },
      "gemini-3-flash-preview": { inputUsdPer1m: 0.5, outputUsdPer1m: 3 },
      "gemini-3.1-flash-lite": { inputUsdPer1m: 0.25, outputUsdPer1m: 1.5 },
      "gemini-2.5-pro": { inputUsdPer1m: 1.25, outputUsdPer1m: 10 },
      "gemini-2.5-flash": { inputUsdPer1m: 0.3, outputUsdPer1m: 2.5 },
      "gemini-2.5-flash-lite": { inputUsdPer1m: 0.1, outputUsdPer1m: 0.4 },
    },
    apiKeyRequired: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    suggestedModels: [
      "gpt-5.4-mini",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-nano",
    ],
    modelStrengths: {
      "gpt-5.4-mini": "medium",
      "gpt-5.6-sol": "strong",
      "gpt-5.6-terra": "strong",
      "gpt-5.6-luna": "medium",
      "gpt-5.5": "strong",
      "gpt-5.4": "strong",
      "gpt-5.4-nano": "weak",
    },
    referencePricing: {
      "gpt-5.4-mini": { inputUsdPer1m: 0.75, outputUsdPer1m: 4.5 },
      "gpt-5.6-sol": { inputUsdPer1m: 5, outputUsdPer1m: 30 },
      "gpt-5.6-terra": { inputUsdPer1m: 2.5, outputUsdPer1m: 15 },
      "gpt-5.6-luna": { inputUsdPer1m: 1, outputUsdPer1m: 6 },
      "gpt-5.5": { inputUsdPer1m: 5, outputUsdPer1m: 30 },
      "gpt-5.4": { inputUsdPer1m: 2.5, outputUsdPer1m: 15 },
      "gpt-5.4-nano": { inputUsdPer1m: 0.2, outputUsdPer1m: 1.25 },
    },
    apiKeyRequired: true,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "openai_compatible",
    // Backend nhận diện host này và gọi Messages API native của Anthropic.
    baseUrl: "https://api.anthropic.com/v1",
    suggestedModels: [
      "claude-sonnet-5",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-8",
      "claude-fable-5",
    ],
    modelStrengths: {
      "claude-sonnet-5": "strong",
      "claude-haiku-4-5-20251001": "medium",
      "claude-opus-4-8": "strong",
      "claude-fable-5": "strong",
    },
    referencePricing: {
      // Sonnet 5 đang có giá ưu đãi 2/10 tới 31/08/2026 — điền giá chuẩn.
      "claude-sonnet-5": { inputUsdPer1m: 3, outputUsdPer1m: 15 },
      "claude-haiku-4-5-20251001": { inputUsdPer1m: 1, outputUsdPer1m: 5 },
      "claude-opus-4-8": { inputUsdPer1m: 5, outputUsdPer1m: 25 },
      "claude-fable-5": { inputUsdPer1m: 10, outputUsdPer1m: 50 },
    },
    apiKeyRequired: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai_compatible",
    baseUrl: "https://api.deepseek.com",
    suggestedModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
    modelStrengths: {
      "deepseek-v4-flash": "medium",
      "deepseek-v4-pro": "strong",
    },
    referencePricing: {
      "deepseek-v4-flash": { inputUsdPer1m: 0.14, outputUsdPer1m: 0.28 },
      "deepseek-v4-pro": { inputUsdPer1m: 0.435, outputUsdPer1m: 0.87 },
    },
    apiKeyRequired: true,
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    suggestedModels: [
      "openai/gpt-oss-120b",
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-20b",
    ],
    modelStrengths: {
      "openai/gpt-oss-120b": "strong",
      "qwen/qwen3.6-27b": "strong",
      "openai/gpt-oss-20b": "medium",
    },
    referencePricing: {
      "openai/gpt-oss-120b": { inputUsdPer1m: 0.15, outputUsdPer1m: 0.6 },
      "qwen/qwen3.6-27b": { inputUsdPer1m: 0.6, outputUsdPer1m: 3 },
      "openai/gpt-oss-20b": { inputUsdPer1m: 0.075, outputUsdPer1m: 0.3 },
    },
    apiKeyRequired: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    suggestedModels: [
      "google/gemini-3.5-flash",
      "anthropic/claude-sonnet-4.6",
      "deepseek/deepseek-v4-pro",
      "openai/gpt-5.4-mini",
      "openai/gpt-oss-120b",
    ],
    modelStrengths: {
      "google/gemini-3.5-flash": "strong",
      "anthropic/claude-sonnet-4.6": "strong",
      "deepseek/deepseek-v4-pro": "strong",
      "openai/gpt-5.4-mini": "medium",
      "openai/gpt-oss-120b": "medium",
    },
    apiKeyRequired: true,
  },
  {
    id: "ollama",
    label: "Ollama local",
    kind: "ollama",
    baseUrl: "http://host.docker.internal:11434",
    suggestedModels: [],
    apiKeyRequired: false,
  },
  {
    id: "custom",
    label: "OpenAI-compatible khác",
    kind: "openai_compatible",
    baseUrl: "https://",
    suggestedModels: [],
    apiKeyRequired: false,
  },
];

export function providerPreset(id: AiProviderPresetId): AiProviderPreset {
  return (
    AI_PROVIDER_PRESETS.find((preset) => preset.id === id) ?? CUSTOM_PRESET
  );
}

export function modelStrength(
  preset: AiProviderPreset,
  model: string,
): AiModelStrength | null {
  return preset.modelStrengths?.[model] ?? null;
}

export function referencePricing(
  preset: AiProviderPreset,
  model: string,
): AiModelReferencePricing | null {
  return preset.referencePricing?.[model] ?? null;
}

export function inferProviderPreset(
  kind: AiProviderKind,
  baseUrl: string,
): AiProviderPresetId {
  const normalized = baseUrl.replace(/\/+$/, "").toLowerCase();
  return (
    AI_PROVIDER_PRESETS.find(
      (preset) =>
        preset.id !== "custom" &&
        preset.kind === kind &&
        preset.baseUrl.replace(/\/+$/, "").toLowerCase() === normalized,
    )?.id ?? (kind === "ollama" ? "ollama" : "custom")
  );
}

const CUSTOM_PRESET: AiProviderPreset = {
  id: "custom",
  label: "OpenAI-compatible khác",
  kind: "openai_compatible",
  baseUrl: "https://",
  suggestedModels: [],
  apiKeyRequired: false,
};
