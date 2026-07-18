import type {
  AiProviderEntity,
  AiProviderKind,
} from './entities/ai-provider.entity';

/** Driver là contract kết nối, không suy luận trong luồng gọi model. */
export enum AiProviderDriver {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  OPENROUTER = 'openrouter',
  DEEPSEEK = 'deepseek',
  GROQ = 'groq',
  OLLAMA = 'ollama',
  OPENAI_COMPATIBLE = 'openai_compatible',
}

const DRIVER_BASE_URL: Record<
  Exclude<
    AiProviderDriver,
    AiProviderDriver.OLLAMA | AiProviderDriver.OPENAI_COMPATIBLE
  >,
  string
> = {
  [AiProviderDriver.OPENAI]: 'https://api.openai.com/v1',
  [AiProviderDriver.ANTHROPIC]: 'https://api.anthropic.com/v1',
  [AiProviderDriver.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta',
  [AiProviderDriver.OPENROUTER]: 'https://openrouter.ai/api/v1',
  [AiProviderDriver.DEEPSEEK]: 'https://api.deepseek.com',
  [AiProviderDriver.GROQ]: 'https://api.groq.com/openai/v1',
};

export function inferProviderDriver(
  kind: AiProviderKind,
  baseUrl: string,
): AiProviderDriver {
  if (kind === 'ollama') return AiProviderDriver.OLLAMA;
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  if (hostname === 'api.openai.com') return AiProviderDriver.OPENAI;
  if (hostname === 'api.anthropic.com') return AiProviderDriver.ANTHROPIC;
  if (hostname === 'generativelanguage.googleapis.com')
    return AiProviderDriver.GEMINI;
  if (hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai'))
    return AiProviderDriver.OPENROUTER;
  if (hostname === 'api.deepseek.com') return AiProviderDriver.DEEPSEEK;
  if (hostname === 'api.groq.com') return AiProviderDriver.GROQ;
  return AiProviderDriver.OPENAI_COMPATIBLE;
}

export function providerDriverFor(
  provider: Pick<AiProviderEntity, 'driver' | 'kind' | 'baseUrl'>,
): AiProviderDriver {
  return (
    provider.driver ?? inferProviderDriver(provider.kind, provider.baseUrl)
  );
}

export function defaultBaseUrlForDriver(
  driver: AiProviderDriver,
): string | null {
  return DRIVER_BASE_URL[driver as keyof typeof DRIVER_BASE_URL] ?? null;
}

export function providerKindForDriver(
  driver: AiProviderDriver,
): AiProviderKind {
  return (
    driver === AiProviderDriver.OLLAMA ? 'ollama' : 'openai_compatible'
  ) as AiProviderKind;
}

export function driverNeedsApiKey(driver: AiProviderDriver): boolean {
  return driver !== AiProviderDriver.OLLAMA;
}
