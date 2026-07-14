import type { AiProviderKind } from "@zunibee/shared";

export type AiProviderPresetId =
  | "openai"
  | "google_gemini"
  | "deepseek"
  | "groq"
  | "openrouter"
  | "ollama"
  | "custom";

/** Đánh giá tương đối giữa các model trong cùng một provider. */
export type AiModelStrength = "strong" | "medium" | "weak";

export type AiProviderPreset = {
  id: AiProviderPresetId;
  label: string;
  kind: AiProviderKind;
  baseUrl: string;
  suggestedModels: string[];
  /** Note sức mạnh hiển thị cạnh model; model discover động sẽ không có note. */
  modelStrengths?: Record<string, AiModelStrength>;
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
      "qwen/qwen3-32b",
      "openai/gpt-oss-20b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    modelStrengths: {
      "openai/gpt-oss-120b": "strong",
      "qwen/qwen3.6-27b": "strong",
      "qwen/qwen3-32b": "medium",
      "openai/gpt-oss-20b": "medium",
      "meta-llama/llama-4-scout-17b-16e-instruct": "weak",
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
