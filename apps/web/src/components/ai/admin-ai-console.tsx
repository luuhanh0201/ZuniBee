"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudCog,
  Cpu,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { AiProvider, AiProviderKind } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";

type ProviderHealth = "online" | "offline" | "checking";
type ProviderRow = AiProvider & {
  health: ProviderHealth;
  latencyMs: number | null;
  requestCount: number;
};

type ProviderDraft = {
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  baseCreditCost: number;
  creditCostPer1kTokens: number;
};

const INITIAL_PROVIDERS: ProviderRow[] = [
  {
    id: "provider-openai",
    name: "OpenAI Production",
    kind: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    isActive: true,
    isDefault: true,
    hasApiKey: true,
    baseCreditCost: 2,
    creditCostPer1kTokens: 1,
    createdAt: "2026-07-08T08:00:00.000Z",
    updatedAt: "2026-07-13T03:20:00.000Z",
    health: "online",
    latencyMs: 842,
    requestCount: 12840,
  },
  {
    id: "provider-ollama",
    name: "Ollama nội bộ",
    kind: "ollama",
    baseUrl: "http://host.docker.internal:11434",
    model: "llama3.2:latest",
    isActive: true,
    isDefault: false,
    hasApiKey: false,
    baseCreditCost: 1,
    creditCostPer1kTokens: 0,
    createdAt: "2026-07-09T08:00:00.000Z",
    updatedAt: "2026-07-12T10:15:00.000Z",
    health: "online",
    latencyMs: 126,
    requestCount: 3216,
  },
  {
    id: "provider-backup",
    name: "OpenAI dự phòng",
    kind: "openai_compatible",
    baseUrl: "https://gateway.example.com/v1",
    model: "gpt-4o-mini",
    isActive: false,
    isDefault: false,
    hasApiKey: true,
    baseCreditCost: 2,
    creditCostPer1kTokens: 1,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    health: "offline",
    latencyMs: null,
    requestCount: 0,
  },
];

const EMPTY_DRAFT: ProviderDraft = {
  name: "",
  kind: "openai_compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  apiKey: "",
  baseCreditCost: 1,
  creditCostPer1kTokens: 1,
};

const buttonFocus =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

export function AdminAiConsole() {
  const [providers, setProviders] = useState<ProviderRow[]>(INITIAL_PROVIDERS);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const activeCount = providers.filter((provider) => provider.isActive).length;
  const onlineCount = providers.filter(
    (provider) => provider.health === "online",
  ).length;

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  function openEdit(provider: ProviderRow) {
    setEditingId(provider.id);
    setDraft({
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: "",
      baseCreditCost: provider.baseCreditCost,
      creditCostPer1kTokens: provider.creditCostPer1kTokens,
    });
    setEditorOpen(true);
  }

  function saveProvider() {
    if (editingId) {
      setProviders((current) =>
        current.map((provider) =>
          provider.id === editingId
            ? {
                ...provider,
                ...draft,
                hasApiKey: Boolean(draft.apiKey) || provider.hasApiKey,
                updatedAt: new Date().toISOString(),
              }
            : provider,
        ),
      );
      setNotice("Đã cập nhật cấu hình provider.");
    } else {
      const provider: ProviderRow = {
        id: crypto.randomUUID(),
        name: draft.name,
        kind: draft.kind,
        baseUrl: draft.baseUrl,
        model: draft.model,
        isActive: true,
        isDefault: providers.length === 0,
        hasApiKey: Boolean(draft.apiKey),
        baseCreditCost: draft.baseCreditCost,
        creditCostPer1kTokens: draft.creditCostPer1kTokens,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        health: "offline",
        latencyMs: null,
        requestCount: 0,
      };
      setProviders((current) => [provider, ...current]);
      setNotice("Đã thêm provider mới vào danh sách demo.");
    }
    setEditorOpen(false);
  }

  function toggleProvider(provider: ProviderRow) {
    if (provider.isDefault && provider.isActive) {
      setNotice("Provider mặc định phải luôn được bật.");
      return;
    }
    setProviders((current) =>
      current.map((item) =>
        item.id === provider.id
          ? {
              ...item,
              isActive: !item.isActive,
              health: item.isActive ? "offline" : item.health,
            }
          : item,
      ),
    );
  }

  function setDefaultProvider(providerId: string) {
    setProviders((current) =>
      current.map((provider) => ({
        ...provider,
        isDefault: provider.id === providerId,
        isActive: provider.id === providerId ? true : provider.isActive,
      })),
    );
    setNotice("Đã đổi provider mặc định.");
  }

  function deleteProvider(provider: ProviderRow) {
    if (provider.isDefault) {
      setNotice("Hãy chọn provider mặc định khác trước khi xóa.");
      return;
    }
    if (!window.confirm(`Xóa provider “${provider.name}”?`)) return;
    setProviders((current) =>
      current.filter((item) => item.id !== provider.id),
    );
    setNotice("Đã xóa provider khỏi danh sách demo.");
  }

  function testConnection(providerId: string) {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === providerId
          ? { ...provider, health: "checking", latencyMs: null }
          : provider,
      ),
    );
    window.setTimeout(() => {
      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId
            ? { ...provider, health: "online", latencyMs: 148 }
            : provider,
        ),
      );
      setNotice("Kết nối thử thành công — phản hồi trong 148 ms.");
    }, 900);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <AdminSidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
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
            <span className="hidden rounded-full border-2 border-foreground bg-success-soft px-3 py-1.5 text-sm font-extrabold sm:inline-flex sm:items-center sm:gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
              Hệ thống ổn định
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-primary font-display font-extrabold shadow-brutal-sm">
              AD
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
              value={String(providers.length).padStart(2, "0")}
              helper={`${activeCount} đang hoạt động`}
              color="bg-secondary-soft"
            />
            <MetricCard
              icon={Activity}
              label="Kết nối ổn định"
              value={`${onlineCount}/${providers.length}`}
              helper="Theo lần kiểm tra gần nhất"
              color="bg-success-soft"
            />
            <MetricCard
              icon={Zap}
              label="Lượt gọi tháng này"
              value="16K"
              helper="+12,4% so với tháng trước"
              color="bg-warning-soft"
            />
            <MetricCard
              icon={Gauge}
              label="Độ trễ trung bình"
              value="484ms"
              helper="Trong ngưỡng cho phép"
              color="bg-primary"
            />
          </section>

          {notice ? (
            <div
              role="status"
              className="mt-6 flex items-center justify-between gap-3 rounded-xl border-2 border-foreground bg-success-soft px-4 py-3 font-bold shadow-brutal-sm"
            >
              <span className="flex items-center gap-2">
                <Check className="h-5 w-5" aria-hidden="true" />
                {notice}
              </span>
              <button
                type="button"
                onClick={() => setNotice("")}
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
              {filteredProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onEdit={() => openEdit(provider)}
                  onToggle={() => toggleProvider(provider)}
                  onDefault={() => setDefaultProvider(provider.id)}
                  onDelete={() => deleteProvider(provider)}
                  onTest={() => testConnection(provider.id)}
                />
              ))}
              {!filteredProviders.length ? (
                <div className="rounded-2xl border-2 border-dashed border-foreground bg-surface-soft p-10 text-center xl:col-span-2">
                  <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-3 font-display text-xl font-extrabold">
                    Không tìm thấy provider
                  </h3>
                  <p className="mt-1 font-semibold text-muted-foreground">
                    Thử từ khóa hoặc bộ lọc trạng thái khác.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <p className="mt-5 text-center text-sm font-semibold text-muted-foreground">
            Bản thiết kế UI demo — thay đổi chỉ được lưu tạm thời trên trình
            duyệt.
          </p>
        </main>
      </div>

      {editorOpen ? (
        <ProviderEditor
          draft={draft}
          editing={Boolean(editingId)}
          onChange={setDraft}
          onClose={() => setEditorOpen(false)}
          onSave={saveProvider}
        />
      ) : null}
    </div>
  );
}

function AdminSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
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
                LA
              </span>
              <div className="min-w-0">
                <p className="truncate font-extrabold">Lưu Hành</p>
                <p className="truncate text-xs font-bold text-muted-foreground">
                  Super Admin
                </p>
              </div>
            </div>
            <button
              type="button"
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
}: {
  provider: ProviderRow;
  onEdit: () => void;
  onToggle: () => void;
  onDefault: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const providerLabel =
    provider.kind === "ollama" ? "Ollama" : "OpenAI-compatible";
  const healthLabel =
    provider.health === "checking"
      ? "Đang kiểm tra"
      : provider.health === "online"
        ? "Trực tuyến"
        : "Ngoại tuyến";
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
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span
            className={`h-2.5 w-2.5 rounded-full ${provider.health === "checking" ? "animate-pulse bg-primary" : provider.health === "online" ? "bg-success" : "bg-destructive"}`}
          />
          {healthLabel}
          {provider.latencyMs ? (
            <span className="font-bold text-muted-foreground">
              · {provider.latencyMs} ms
            </span>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
          <span className="text-sm">{provider.isActive ? "Bật" : "Tắt"}</span>
          <input
            type="checkbox"
            checked={provider.isActive}
            onChange={onToggle}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 rounded-full border-2 border-foreground bg-divider transition-colors peer-checked:bg-success peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border-2 after:border-foreground after:bg-surface after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={provider.health === "checking"}
          onClick={onTest}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-sm font-extrabold transition-colors hover:bg-secondary-soft disabled:cursor-wait disabled:opacity-60 ${buttonFocus}`}
        >
          <Activity className="h-4 w-4" aria-hidden="true" />
          Kiểm tra
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-sm font-extrabold transition-colors hover:bg-primary ${buttonFocus}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Chỉnh sửa
        </button>
        {!provider.isDefault ? (
          <button
            type="button"
            onClick={onDefault}
            className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-3 text-sm font-extrabold transition-colors hover:bg-primary ${buttonFocus}`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Mặc định
          </button>
        ) : null}
        <button
          type="button"
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
}: {
  draft: ProviderDraft;
  editing: boolean;
  onChange: (draft: ProviderDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const valid =
    draft.name.trim() && draft.baseUrl.trim() && draft.model.trim();
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
          <EditorField label="Loại provider">
            <select
              value={draft.kind}
              onChange={(event) =>
                onChange({
                  ...draft,
                  kind: event.target.value as AiProviderKind,
                  baseUrl:
                    event.target.value === "ollama"
                      ? "http://host.docker.internal:11434"
                      : "https://api.openai.com/v1",
                })
              }
              className="min-h-12 w-full cursor-pointer rounded-xl border-2 border-foreground bg-surface px-3 font-bold outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="openai_compatible">OpenAI-compatible</option>
              <option value="ollama">Ollama</option>
            </select>
          </EditorField>
          <EditorField label="Tên model">
            <input
              required
              value={draft.model}
              onChange={(event) =>
                onChange({ ...draft, model: event.target.value })
              }
              placeholder="gpt-4.1-mini"
              className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </EditorField>
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
            hint="Khóa được che trong giao diện demo."
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
              className={`min-h-12 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-5 font-extrabold transition-colors hover:bg-surface-soft ${buttonFocus}`}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!valid}
              className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-md transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none ${buttonFocus}`}
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              {editing ? "Lưu thay đổi" : "Thêm provider"}
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
