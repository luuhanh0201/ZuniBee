"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bot,
  Brain,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudCog,
  Cpu,
  Gauge,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type {
  AiProvider,
  AiProviderKind,
  AiProviderMetrics,
  AuthUser,
  CreateAiProviderRequest,
} from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";
import {
  adminCreateAiProvider,
  adminDeleteAiProvider,
  adminDiscoverAiProviderModels,
  adminDiscoverSavedAiProviderModels,
  adminGetAiProviderMetrics,
  adminListAiProviders,
  adminTestAiProvider,
  adminTestAiProviderConfiguration,
  adminUpdateAiProvider,
} from "./ai-api";
import {
  AI_PROVIDER_PRESETS,
  inferProviderPreset,
  modelStrength,
  providerPreset,
  type AiModelStrength,
  type AiProviderPresetId,
} from "./ai-provider-catalog";
import { SelectMenu } from "@/components/ui/select-menu";

function strengthIcon(strength: AiModelStrength | null): React.ReactNode {
  if (strength === "strong")
    return (
      <BatteryFull
        className="h-4 w-4 shrink-0 text-success"
        aria-hidden="true"
      />
    );
  if (strength === "medium")
    return (
      <BatteryMedium
        className="h-4 w-4 shrink-0 text-amber-500"
        aria-hidden="true"
      />
    );
  if (strength === "weak")
    return (
      <BatteryLow
        className="h-4 w-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
    );
  return undefined;
}

const STRENGTH_TITLES: Record<AiModelStrength, string> = {
  strong: "Mạnh — chất lượng cao nhất, chi phí cao hơn",
  medium: "Trung bình — cân bằng giữa chất lượng và chi phí",
  weak: "Yếu — nhanh và rẻ, chất lượng thấp hơn",
};

const PRESET_ICONS: Record<AiProviderPresetId, React.ReactNode> = {
  google_gemini: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />,
  openai: <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />,
  deepseek: <Brain className="h-4 w-4 shrink-0" aria-hidden="true" />,
  groq: <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />,
  openrouter: <Route className="h-4 w-4 shrink-0" aria-hidden="true" />,
  ollama: <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />,
  custom: <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />,
};

type ProviderDraft = {
  presetId: AiProviderPresetId;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  baseCreditCost: number;
  creditCostPer1kTokens: number;
};

type Notice = { tone: "success" | "error"; message: string };
type DraftConnectionTest = {
  ok: boolean;
  message: string;
  latencyMs: number | null;
  fingerprint: string;
};

const EMPTY_DRAFT: ProviderDraft = {
  presetId: "google_gemini",
  name: "",
  kind: "openai_compatible",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-3.5-flash",
  apiKey: "",
  baseCreditCost: 1,
  creditCostPer1kTokens: 1,
};

const buttonFocus =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

const fetchProviderData = (accessToken: string) =>
  Promise.all([
    adminListAiProviders(accessToken),
    adminGetAiProviderMetrics(accessToken),
  ]);

export function AdminAiConsole() {
  const { accessToken, logout, user } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [metrics, setMetrics] = useState<AiProviderMetrics | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>(
    providerPreset(EMPTY_DRAFT.presetId).suggestedModels,
  );
  const [isDiscoveringModels, setIsDiscoveringModels] = useState(false);
  const [isTestingDraft, setIsTestingDraft] = useState(false);
  const [draftConnectionTest, setDraftConnectionTest] =
    useState<DraftConnectionTest | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [providerRows, providerMetrics] =
        await fetchProviderData(accessToken);
      setProviders(providerRows);
      setMetrics(providerMetrics);
      setLoadError("");
    } catch (cause) {
      setLoadError(getErrorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void fetchProviderData(accessToken)
      .then(([providerRows, providerMetrics]) => {
        if (!active) return;
        setProviders(providerRows);
        setMetrics(providerMetrics);
        setLoadError("");
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(getErrorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return providers.filter((provider) => {
      const matchesQuery =
        !normalized ||
        [provider.name, provider.model, provider.baseUrl]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalized);
      const matchesStatus =
        status === "all" ||
        (status === "active" ? provider.isActive : !provider.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [providers, query, status]);

  const activeCount = metrics?.activeProviders ?? 0;
  const onlineCount = metrics?.onlineProviders ?? 0;
  const systemStatus = getSystemStatus(metrics, isLoading);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setModelOptions(providerPreset(EMPTY_DRAFT.presetId).suggestedModels);
    setDraftConnectionTest(null);
    setEditorOpen(true);
  }

  function openEdit(provider: AiProvider) {
    const presetId = inferProviderPreset(provider.kind, provider.baseUrl);
    const suggested = providerPreset(presetId).suggestedModels;
    setEditingId(provider.id);
    setDraft({
      presetId,
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: "",
      baseCreditCost: provider.baseCreditCost,
      creditCostPer1kTokens: provider.creditCostPer1kTokens,
    });
    setModelOptions(
      suggested.includes(provider.model)
        ? suggested
        : [provider.model, ...suggested],
    );
    setDraftConnectionTest(null);
    setEditorOpen(true);
  }

  function updateDraft(next: ProviderDraft) {
    if (
      next.kind !== draft.kind ||
      next.baseUrl !== draft.baseUrl ||
      next.model !== draft.model ||
      next.apiKey !== draft.apiKey
    ) {
      setDraftConnectionTest(null);
    }
    setDraft(next);
  }

  function selectProviderPreset(presetId: AiProviderPresetId) {
    const preset = providerPreset(presetId);
    setModelOptions(preset.suggestedModels);
    setDraftConnectionTest(null);
    setDraft((current) => ({
      ...current,
      presetId,
      kind: preset.kind,
      baseUrl: preset.baseUrl,
      model: preset.suggestedModels[0] ?? "",
      apiKey: "",
    }));
  }

  async function discoverModels() {
    if (!accessToken || isDiscoveringModels) return;
    setIsDiscoveringModels(true);
    try {
      const saved = editingId
        ? providers.find((provider) => provider.id === editingId)
        : undefined;
      const canUseSavedConfiguration =
        saved &&
        !draft.apiKey &&
        saved.kind === draft.kind &&
        saved.baseUrl.replace(/\/+$/, "") === draft.baseUrl.replace(/\/+$/, "");
      const result =
        canUseSavedConfiguration && editingId
          ? await adminDiscoverSavedAiProviderModels(editingId, accessToken)
          : await adminDiscoverAiProviderModels(
              {
                kind: draft.kind,
                baseUrl: draft.baseUrl.trim(),
                ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
              },
              accessToken,
            );
      setModelOptions(result.models);
      if (!result.models.includes(draft.model)) {
        setDraftConnectionTest(null);
        setDraft((current) => ({
          ...current,
          model: result.models[0] ?? "",
        }));
      }
      setNotice({
        tone: "success",
        message: `Đã đồng bộ ${result.models.length} model từ provider.`,
      });
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setIsDiscoveringModels(false);
    }
  }

  async function testDraftConfiguration() {
    if (!accessToken || isTestingDraft) return;
    setIsTestingDraft(true);
    setDraftConnectionTest(null);
    const fingerprint = providerConnectionFingerprint(draft);
    try {
      const result = await adminTestAiProviderConfiguration(
        {
          kind: draft.kind,
          baseUrl: draft.baseUrl.trim(),
          model: draft.model.trim(),
          ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
        },
        accessToken,
      );
      setDraftConnectionTest({ ...result, fingerprint });
    } catch (cause) {
      setDraftConnectionTest({
        ok: false,
        message: getErrorMessage(cause),
        latencyMs: null,
        fingerprint,
      });
    } finally {
      setIsTestingDraft(false);
    }
  }

  async function saveProvider() {
    if (
      !accessToken ||
      isSaving ||
      (!editingId &&
        (!draftConnectionTest?.ok ||
          draftConnectionTest.fingerprint !==
            providerConnectionFingerprint(draft)))
    )
      return;
    setIsSaving(true);
    const body: CreateAiProviderRequest = {
      name: draft.name.trim(),
      kind: draft.kind,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      baseCreditCost: draft.baseCreditCost,
      creditCostPer1kTokens: draft.creditCostPer1kTokens,
      ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
    };
    try {
      if (editingId) {
        await adminUpdateAiProvider(editingId, body, accessToken);
        setNotice({ tone: "success", message: "Đã cập nhật provider thật." });
      } else {
        await adminCreateAiProvider(
          {
            ...body,
            isActive: true,
            isDefault: providers.length === 0,
          },
          accessToken,
        );
        setNotice({
          tone: "success",
          message: "Đã thêm provider vào hệ thống.",
        });
      }
      setEditorOpen(false);
      await loadData();
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleProvider(provider: AiProvider) {
    if (provider.isDefault && provider.isActive) {
      setNotice({
        tone: "error",
        message: "Provider mặc định phải luôn được bật.",
      });
      return;
    }
    if (!accessToken || actionId) return;
    setActionId(provider.id);
    try {
      await adminUpdateAiProvider(
        provider.id,
        { isActive: !provider.isActive },
        accessToken,
      );
      setNotice({
        tone: "success",
        message: provider.isActive ? "Đã tắt provider." : "Đã bật provider.",
      });
      await loadData();
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setActionId(null);
    }
  }

  async function setDefaultProvider(providerId: string) {
    if (!accessToken || actionId) return;
    setActionId(providerId);
    try {
      await adminUpdateAiProvider(
        providerId,
        { isDefault: true, isActive: true },
        accessToken,
      );
      setNotice({ tone: "success", message: "Đã đổi provider mặc định." });
      await loadData();
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setActionId(null);
    }
  }

  async function deleteProvider(provider: AiProvider) {
    if (provider.isDefault) {
      setNotice({
        tone: "error",
        message: "Hãy chọn provider mặc định khác trước khi xóa.",
      });
      return;
    }
    if (!window.confirm(`Xóa provider “${provider.name}”?`)) return;
    if (!accessToken || actionId) return;
    setActionId(provider.id);
    try {
      await adminDeleteAiProvider(provider.id, accessToken);
      setNotice({ tone: "success", message: "Đã xóa provider khỏi hệ thống." });
      await loadData();
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setActionId(null);
    }
  }

  async function testConnection(providerId: string) {
    if (!accessToken || checkingIds.has(providerId)) return;
    setCheckingIds((current) => new Set(current).add(providerId));
    try {
      const result = await adminTestAiProvider(providerId, accessToken);
      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId ? result.provider : provider,
        ),
      );
      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
      const nextMetrics = await adminGetAiProviderMetrics(accessToken);
      setMetrics(nextMetrics);
    } catch (cause) {
      setNotice({ tone: "error", message: getErrorMessage(cause) });
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(providerId);
        return next;
      });
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <AdminSidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        user={user!}
        onLogout={() => void logout()}
      />

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b-2 border-foreground bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Mở menu quản trị"
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm lg:hidden ${buttonFocus}`}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                Quản trị hệ thống
              </p>
              <h1 className="font-display text-xl font-extrabold sm:text-2xl">
                AI Providers
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`hidden rounded-full border-2 border-foreground px-3 py-1.5 text-sm font-extrabold sm:inline-flex sm:items-center sm:gap-2 ${systemStatus.containerClass}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${systemStatus.dotClass}`}
              />
              {systemStatus.label}
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-primary font-display font-extrabold shadow-brutal-sm">
              {initials(user?.fullName ?? "Admin")}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <section className="relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-purple px-5 py-7 text-white shadow-brutal-xl sm:px-8">
            <div
              aria-hidden="true"
              className="absolute -right-9 -top-14 h-44 w-44 rotate-12 rounded-[2.5rem] border-[3px] border-foreground bg-primary"
            />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-surface px-3 py-1.5 text-sm font-extrabold text-foreground shadow-brutal-sm">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  AI Control Center
                </span>
                <h2 className="mt-5 max-w-2xl font-display text-3xl font-extrabold sm:text-4xl">
                  Điều phối mô hình AI từ một nơi duy nhất.
                </h2>
                <p className="mt-3 max-w-2xl font-semibold leading-relaxed text-on-purple-muted">
                  Quản lý endpoint, model, chi phí và provider mặc định cho toàn
                  bộ tính năng AI của ZuniBee.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold text-foreground shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg motion-reduce:transform-none md:self-auto ${buttonFocus}`}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Thêm provider
              </button>
            </div>
          </section>

          <section
            aria-label="Tổng quan provider"
            className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              icon={ServerCog}
              label="Tổng provider"
              value={String(metrics?.totalProviders ?? 0).padStart(2, "0")}
              helper={`${activeCount} đang hoạt động`}
              color="bg-secondary-soft"
            />
            <MetricCard
              icon={Activity}
              label="Kết nối ổn định"
              value={`${onlineCount}/${activeCount}`}
              helper="Theo lần kiểm tra gần nhất"
              color="bg-success-soft"
            />
            <MetricCard
              icon={Zap}
              label="Tác vụ AI tháng này"
              value={formatNumber(metrics?.requestsThisMonth ?? 0)}
              helper="Sinh quiz và phân tích kết quả"
              color="bg-warning-soft"
            />
            <MetricCard
              icon={Gauge}
              label="Độ trễ trung bình"
              value={
                metrics?.averageLatencyMs == null
                  ? "--"
                  : `${metrics.averageLatencyMs}ms`
              }
              helper="Từ các provider online đã kiểm tra"
              color="bg-primary"
            />
          </section>

          {notice ? (
            <div
              role="status"
              className={`mt-6 flex items-center justify-between gap-3 rounded-xl border-2 border-foreground px-4 py-3 font-bold shadow-brutal-sm ${notice.tone === "success" ? "bg-success-soft" : "bg-destructive-soft"}`}
            >
              <span className="flex items-center gap-2">
                <Check className="h-5 w-5" aria-hidden="true" />
                {notice.message}
              </span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Đóng thông báo"
                className={`cursor-pointer rounded-md p-1 hover:bg-surface/60 ${buttonFocus}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <section className="mt-6 rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
            <div className="flex flex-col gap-4 border-b-2 border-foreground p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="font-display text-2xl font-extrabold">
                  Danh sách provider
                </h2>
                <p className="mt-1 font-semibold text-muted-foreground">
                  Cấu hình provider dùng để tạo quiz và phân tích kết quả.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block min-w-0 sm:w-72">
                  <span className="sr-only">Tìm provider</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm tên, model, endpoint..."
                    className={`min-h-11 w-full rounded-xl border-2 border-foreground bg-background py-2 pl-10 pr-3 font-semibold outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring`}
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">Lọc trạng thái</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as "all" | "active" | "inactive",
                      )
                    }
                    className="min-h-11 w-full cursor-pointer appearance-none rounded-xl border-2 border-foreground bg-background py-2 pl-3 pr-10 font-bold outline-none focus:ring-2 focus:ring-ring sm:w-auto"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang bật</option>
                    <option value="inactive">Đang tắt</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
              {isLoading ? (
                <div className="flex min-h-52 items-center justify-center gap-3 font-bold text-muted-foreground xl:col-span-2">
                  <Loader2
                    className="h-6 w-6 animate-spin"
                    aria-hidden="true"
                  />
                  Đang tải cấu hình provider thật...
                </div>
              ) : loadError ? (
                <div className="rounded-2xl border-2 border-destructive bg-destructive-soft p-8 text-center xl:col-span-2">
                  <p className="font-extrabold">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoading(true);
                      void loadData();
                    }}
                    className={`mt-4 min-h-10 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-bold ${buttonFocus}`}
                  >
                    Thử tải lại
                  </button>
                </div>
              ) : null}
              {!isLoading && !loadError
                ? filteredProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onEdit={() => openEdit(provider)}
                      onToggle={() => void toggleProvider(provider)}
                      onDefault={() => void setDefaultProvider(provider.id)}
                      onDelete={() => void deleteProvider(provider)}
                      onTest={() => void testConnection(provider.id)}
                      checking={checkingIds.has(provider.id)}
                      busy={actionId === provider.id}
                    />
                  ))
                : null}
              {!isLoading && !loadError && !filteredProviders.length ? (
                <div className="rounded-2xl border-2 border-dashed border-foreground bg-surface-soft p-10 text-center xl:col-span-2">
                  <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-3 font-display text-xl font-extrabold">
                    Không tìm thấy provider
                  </h3>
                  <p className="mt-1 font-semibold text-muted-foreground">
                    {providers.length
                      ? "Thử từ khóa hoặc bộ lọc trạng thái khác."
                      : "Chưa có provider nào trong database. Hãy thêm provider đầu tiên."}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      {editorOpen ? (
        <ProviderEditor
          draft={draft}
          editing={Boolean(editingId)}
          onChange={updateDraft}
          onClose={() => setEditorOpen(false)}
          onSave={() => void saveProvider()}
          saving={isSaving}
          modelOptions={modelOptions}
          discoveringModels={isDiscoveringModels}
          onPresetChange={selectProviderPreset}
          onDiscoverModels={() => void discoverModels()}
          testingDraft={isTestingDraft}
          connectionTest={draftConnectionTest}
          onTestDraft={() => void testDraftConfiguration()}
          hasUsableStoredKey={Boolean(
            editingId &&
            providers.some(
              (provider) =>
                provider.id === editingId &&
                provider.hasApiKey &&
                provider.kind === draft.kind &&
                provider.baseUrl.replace(/\/+$/, "") ===
                  draft.baseUrl.replace(/\/+$/, ""),
            ),
          )}
        />
      ) : null}
    </div>
  );
}

function AdminSidebar({
  mobileOpen,
  onClose,
  user,
  onLogout,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
}) {
  const items = [
    { icon: LayoutDashboard, label: "Tổng quan", active: false },
    { icon: CloudCog, label: "AI Providers", active: true },
    { icon: CircleDollarSign, label: "AI Credit", active: false },
    { icon: Users, label: "Người dùng", active: false },
    { icon: ShieldCheck, label: "Phân quyền", active: false },
    { icon: Settings2, label: "Cài đặt", active: false },
  ];
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Đóng menu quản trị"
          onClick={onClose}
          className="fixed inset-0 z-30 cursor-default bg-foreground/40 lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r-2 border-foreground bg-surface transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex min-h-20 items-center justify-between border-b-2 border-foreground px-5">
          <Link
            href={ROUTES.home}
            className={`flex cursor-pointer items-center gap-3 rounded-lg ${buttonFocus}`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <strong className="block font-display text-xl">ZuniBee</strong>
              <small className="font-extrabold uppercase tracking-wider text-muted-foreground">
                Admin
              </small>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className={`cursor-pointer rounded-lg p-2 hover:bg-surface-soft lg:hidden ${buttonFocus}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Điều hướng quản trị" className="flex-1 space-y-1 p-4">
          <p className="px-3 pb-2 pt-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
            Workspace
          </p>
          {items.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              type="button"
              aria-current={active ? "page" : undefined}
              disabled={!active}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-2 px-3 text-left font-bold transition-colors duration-200 ${active ? "cursor-pointer border-foreground bg-primary shadow-brutal-sm" : "cursor-not-allowed border-transparent text-muted-foreground"} ${buttonFocus}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t-2 border-foreground p-4">
          <div className="rounded-2xl border-2 border-foreground bg-secondary-soft p-4 shadow-brutal-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-surface font-extrabold">
                {initials(user.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-extrabold">{user.fullName}</p>
                <p className="truncate text-xs font-bold text-muted-foreground">
                  {user.email ?? "Quản trị viên"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className={`mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 font-bold transition-colors hover:bg-warning-soft ${buttonFocus}`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  helper: string;
  color: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm ${color}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        {helper}
      </p>
    </article>
  );
}

function ProviderCard({
  provider,
  onEdit,
  onToggle,
  onDefault,
  onDelete,
  onTest,
  checking,
  busy,
}: {
  provider: AiProvider;
  onEdit: () => void;
  onToggle: () => void;
  onDefault: () => void;
  onDelete: () => void;
  onTest: () => void;
  checking: boolean;
  busy: boolean;
}) {
  const providerLabel = providerPreset(
    inferProviderPreset(provider.kind, provider.baseUrl),
  ).label;
  const healthLabel = checking
    ? "Đang kiểm tra"
    : provider.healthStatus === "online"
      ? "Trực tuyến"
      : provider.healthStatus === "offline"
        ? "Ngoại tuyến"
        : "Chưa kiểm tra";
  return (
    <article
      className={`relative rounded-2xl border-2 border-foreground p-5 transition-colors duration-200 ${provider.isActive ? "bg-background" : "bg-surface-soft"}`}
    >
      {provider.isDefault ? (
        <span className="absolute -right-2 -top-3 inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-warning-soft px-3 py-1 text-xs font-extrabold shadow-brutal-sm">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Mặc định
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm ${provider.kind === "ollama" ? "bg-secondary-soft" : "bg-primary"}`}
        >
          {provider.kind === "ollama" ? (
            <ServerCog className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Bot className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-extrabold">
            {provider.name}
          </h3>
          <p className="mt-0.5 text-sm font-bold text-muted-foreground">
            {providerLabel}
          </p>
        </div>
        <MoreHorizontal
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <dl className="mt-5 grid gap-3 rounded-xl border-2 border-divider bg-surface p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-bold text-muted-foreground">Model</dt>
          <dd className="mt-1 truncate font-extrabold">{provider.model}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">Chi phí</dt>
          <dd className="mt-1 font-extrabold tabular-nums">
            {provider.baseCreditCost} + {provider.creditCostPer1kTokens}/1K
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="font-bold text-muted-foreground">Endpoint</dt>
          <dd className="mt-1 truncate font-mono text-xs font-bold">
            {provider.baseUrl}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">
            Tác vụ AI ghi nhận
          </dt>
          <dd className="mt-1 font-extrabold tabular-nums">
            {formatNumber(provider.requestCount)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">Kiểm tra gần nhất</dt>
          <dd className="mt-1 font-extrabold">
            {provider.lastHealthCheckedAt
              ? formatDateTime(provider.lastHealthCheckedAt)
              : "Chưa có"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span
            className={`h-2.5 w-2.5 rounded-full ${checking ? "animate-pulse bg-primary" : provider.healthStatus === "online" ? "bg-success" : provider.healthStatus === "offline" ? "bg-destructive" : "bg-divider"}`}
          />
          {healthLabel}
          {provider.lastHealthLatencyMs != null ? (
            <span className="font-bold text-muted-foreground">
              · {provider.lastHealthLatencyMs} ms
            </span>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
          <span className="text-sm">{provider.isActive ? "Bật" : "Tắt"}</span>
          <input
            type="checkbox"
            checked={provider.isActive}
            onChange={onToggle}
            disabled={busy}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 rounded-full border-2 border-foreground bg-divider transition-colors peer-checked:bg-success peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border-2 after:border-foreground after:bg-surface after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {provider.lastHealthError ? (
        <p className="mt-3 rounded-lg bg-destructive-soft px-3 py-2 text-xs font-bold text-destructive">
          {provider.lastHealthError}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={checking || busy}
          onClick={onTest}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-sm font-extrabold transition-colors hover:bg-secondary-soft disabled:cursor-wait disabled:opacity-60 ${buttonFocus}`}
        >
          <Activity className="h-4 w-4" aria-hidden="true" />
          Kiểm tra
        </button>
        <button
          type="button"
          disabled={busy || checking}
          onClick={onEdit}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-sm font-extrabold transition-colors hover:bg-primary ${buttonFocus}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Chỉnh sửa
        </button>
        {!provider.isDefault ? (
          <button
            type="button"
            disabled={busy || checking}
            onClick={onDefault}
            className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-3 text-sm font-extrabold transition-colors hover:bg-primary ${buttonFocus}`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Mặc định
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || checking}
          onClick={onDelete}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-sm font-extrabold transition-colors hover:bg-destructive-soft ${buttonFocus}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Xóa
        </button>
      </div>
    </article>
  );
}

function ProviderEditor({
  draft,
  editing,
  onChange,
  onClose,
  onSave,
  saving,
  modelOptions,
  discoveringModels,
  onPresetChange,
  onDiscoverModels,
  hasUsableStoredKey,
  testingDraft,
  connectionTest,
  onTestDraft,
}: {
  draft: ProviderDraft;
  editing: boolean;
  onChange: (draft: ProviderDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  modelOptions: string[];
  discoveringModels: boolean;
  onPresetChange: (presetId: AiProviderPresetId) => void;
  onDiscoverModels: () => void;
  hasUsableStoredKey: boolean;
  testingDraft: boolean;
  connectionTest: DraftConnectionTest | null;
  onTestDraft: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const selectedPreset = providerPreset(draft.presetId);
  const customModel = !modelOptions.includes(draft.model);
  const hasRequiredKey =
    !selectedPreset.apiKeyRequired ||
    Boolean(draft.apiKey.trim()) ||
    hasUsableStoredKey;
  const currentConnectionTest =
    connectionTest?.fingerprint === providerConnectionFingerprint(draft)
      ? connectionTest
      : null;
  const valid =
    draft.name.trim() &&
    draft.baseUrl.trim() &&
    draft.model.trim() &&
    hasRequiredKey &&
    (editing || currentConnectionTest?.ok);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-editor-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-0 sm:items-center sm:p-4"
    >
      <div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl border-[3px] border-foreground bg-background shadow-brutal-xl sm:max-w-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-2 border-foreground bg-primary p-5 sm:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              Provider configuration
            </p>
            <h2
              id="provider-editor-title"
              className="mt-1 font-display text-2xl font-extrabold"
            >
              {editing ? "Chỉnh sửa provider" : "Thêm provider mới"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm ${buttonFocus}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSave();
          }}
          className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
        >
          <EditorField label="Tên provider" className="sm:col-span-2">
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="Ví dụ: OpenAI Production"
              className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </EditorField>
          <EditorField label="Provider">
            <SelectMenu
              value={draft.presetId}
              onChange={(presetId) =>
                onPresetChange(presetId as AiProviderPresetId)
              }
              options={AI_PROVIDER_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.label,
                icon: PRESET_ICONS[preset.id],
              }))}
            />
          </EditorField>
          <EditorField label="Tên model">
            <SelectMenu
              value={customModel ? "__custom" : draft.model}
              onChange={(model) =>
                onChange({
                  ...draft,
                  model: model === "__custom" ? "" : model,
                })
              }
              options={[
                ...modelOptions.map((model) => {
                  const strength = modelStrength(selectedPreset, model);
                  return {
                    value: model,
                    label: model,
                    icon: strengthIcon(strength),
                    title: strength ? STRENGTH_TITLES[strength] : undefined,
                  };
                }),
                {
                  value: "__custom",
                  label: "Model khác...",
                  title: "Tự nhập model ID chính xác",
                },
              ]}
            />
          </EditorField>
          {customModel ? (
            <EditorField label="Model tùy chỉnh" className="sm:col-span-2">
              <input
                required
                value={draft.model}
                onChange={(event) =>
                  onChange({ ...draft, model: event.target.value })
                }
                placeholder="Nhập model ID chính xác"
                className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-mono text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
              />
            </EditorField>
          ) : null}
          <EditorField label="Base URL" className="sm:col-span-2">
            <input
              required
              type="url"
              value={draft.baseUrl}
              onChange={(event) =>
                onChange({ ...draft, baseUrl: event.target.value })
              }
              className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-mono text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </EditorField>
          <EditorField
            label={editing ? "API key mới (không bắt buộc)" : "API key"}
            hint={
              selectedPreset.apiKeyRequired
                ? "Bắt buộc với provider này. Khóa được mã hóa ở backend."
                : "Không bắt buộc. Khóa được mã hóa ở backend."
            }
            className="sm:col-span-2"
          >
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                onChange={(event) =>
                  onChange({ ...draft, apiKey: event.target.value })
                }
                autoComplete="new-password"
                placeholder={editing ? "Để trống để giữ nguyên" : "sk-..."}
                className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface py-2 pl-10 pr-20 font-mono text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg px-2 py-1 text-xs font-extrabold hover:bg-surface-soft ${buttonFocus}`}
              >
                {showKey ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </EditorField>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={onDiscoverModels}
              disabled={
                discoveringModels || !draft.baseUrl.trim() || !hasRequiredKey
              }
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-secondary-soft px-4 font-extrabold transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
            >
              <RefreshCw
                className={`h-4 w-4 ${discoveringModels ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {discoveringModels
                ? "Đang tải model..."
                : "Đồng bộ model từ provider"}
            </button>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Danh sách được đọc trực tiếp từ endpoint hiện tại. Provider cloud
              cần API key hợp lệ; khi chỉnh sửa có thể dùng khóa đã lưu.
            </p>
          </div>
          {!editing ? (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={onTestDraft}
                disabled={
                  testingDraft ||
                  discoveringModels ||
                  !draft.baseUrl.trim() ||
                  !draft.model.trim() ||
                  !hasRequiredKey
                }
                className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-4 font-extrabold transition-colors hover:bg-success-soft disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
              >
                {testingDraft ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {testingDraft ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </button>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Provider chỉ có thể được thêm sau khi endpoint, API key và model
                hiện tại kiểm tra thành công.
              </p>
              {currentConnectionTest ? (
                <p
                  role={currentConnectionTest.ok ? "status" : "alert"}
                  className={`mt-3 rounded-xl border-2 border-foreground px-3 py-2 text-sm font-bold ${currentConnectionTest.ok ? "bg-success-soft" : "bg-destructive-soft text-destructive"}`}
                >
                  {currentConnectionTest.message}
                </p>
              ) : null}
            </div>
          ) : null}
          <EditorField label="Credit cơ bản">
            <input
              type="number"
              min={0}
              value={draft.baseCreditCost}
              onChange={(event) =>
                onChange({
                  ...draft,
                  baseCreditCost: Number(event.target.value),
                })
              }
              className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </EditorField>
          <EditorField label="Credit / 1K token">
            <input
              type="number"
              min={0}
              value={draft.creditCostPer1kTokens}
              onChange={(event) =>
                onChange({
                  ...draft,
                  creditCostPer1kTokens: Number(event.target.value),
                })
              }
              className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </EditorField>

          <div className="flex flex-col-reverse gap-3 border-t-2 border-divider pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`min-h-12 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-5 font-extrabold transition-colors hover:bg-surface-soft ${buttonFocus}`}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-md transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none ${buttonFocus}`}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-5 w-5" aria-hidden="true" />
              )}
              {saving
                ? "Đang lưu..."
                : editing
                  ? "Lưu thay đổi"
                  : currentConnectionTest?.ok
                    ? "Thêm provider"
                    : "Kiểm tra kết nối trước"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditorField({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block font-extrabold ${className}`}>
      {label}
      {hint ? (
        <span className="ml-2 text-xs font-semibold text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Không thể kết nối tới API quản trị AI";
}

function getSystemStatus(
  metrics: AiProviderMetrics | null,
  loading: boolean,
): { label: string; containerClass: string; dotClass: string } {
  if (loading)
    return {
      label: "Đang đồng bộ",
      containerClass: "bg-surface-soft",
      dotClass: "animate-pulse bg-primary",
    };
  if (!metrics?.totalProviders)
    return {
      label: "Chưa cấu hình provider",
      containerClass: "bg-warning-soft",
      dotClass: "bg-warning",
    };
  if (
    metrics.activeProviders > 0 &&
    metrics.onlineProviders === metrics.activeProviders
  )
    return {
      label: "Hệ thống ổn định",
      containerClass: "bg-success-soft",
      dotClass: "bg-success",
    };
  return {
    label: "Cần kiểm tra kết nối",
    containerClass: "bg-warning-soft",
    dotClass: "bg-warning",
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD"
  );
}

function providerConnectionFingerprint(draft: ProviderDraft): string {
  return JSON.stringify([
    draft.kind,
    draft.baseUrl.trim().replace(/\/+$/, ""),
    draft.model.trim(),
    draft.apiKey.trim(),
  ]);
}
