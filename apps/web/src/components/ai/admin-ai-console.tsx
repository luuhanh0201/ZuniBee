"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Cpu, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
import type {
  AiCreditAdminUser,
  AiProvider,
  AiProviderKind,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  adminCreateAiProvider,
  adminGrantAiCredit,
  adminListAiProviders,
  adminSearchCreditUsers,
  adminUpdateAiProvider,
} from "./ai-api";

export function AdminAiConsole() {
  const { accessToken } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [users, setUsers] = useState<AiCreditAdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [providerRows, userRows] = await Promise.all([
        adminListAiProviders(accessToken),
        adminSearchCreditUsers(query, accessToken),
      ]);
      setProviders(providerRows);
      setUsers(userRows);
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, [accessToken, query]);
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([
      adminListAiProviders(accessToken),
      adminSearchCreditUsers(query, accessToken),
    ])
      .then(([providerRows, userRows]) => {
        if (!active) return;
        setProviders(providerRows);
        setUsers(userRows);
        setError("");
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, query]);
  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <main className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-extrabold uppercase text-muted-foreground">
              <ShieldCheck className="h-5 w-5" />
              Quản trị hệ thống
            </p>
            <h1 className="font-display text-4xl font-extrabold">
              AI Provider & Credit
            </h1>
            <p className="mt-2 font-semibold text-muted-foreground">
              Quản lý provider mà không làm lộ API key và cấp credit có audit
              ledger.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className={SECONDARY_ACTION_CLASS}
          >
            <RefreshCw className="h-5 w-5" />
            Làm mới
          </button>
        </header>
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="mb-5 rounded-xl border-2 border-foreground bg-success-soft p-3 font-bold"
          >
            {notice}
          </p>
        ) : null}
        <div className="grid items-start gap-7 xl:grid-cols-2">
          <section className="space-y-5">
            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Cpu className="h-6 w-6" />
                Provider registry
              </h2>
              <p className="font-semibold text-muted-foreground">
                Chỉ một provider mặc định; API key đã lưu sẽ không được trả về
                trình duyệt.
              </p>
            </div>
            <ProviderForm
              onCreated={async () => {
                setNotice("Đã lưu provider AI.");
                await load();
              }}
              onError={(cause) => setError(getErrorMessage(cause))}
              token={accessToken ?? undefined}
            />
            <div className="space-y-3">
              {providers.map((provider) => (
                <article
                  key={provider.id}
                  className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-extrabold">
                        {provider.name}
                      </h3>
                      <p className="font-bold text-muted-foreground">
                        {provider.kind} · {provider.model}
                      </p>
                      <p className="mt-1 break-all text-sm font-semibold">
                        {provider.baseUrl}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full border-2 border-foreground bg-surface-soft px-2 py-1 text-xs font-extrabold">
                        {provider.hasApiKey ? "Có API key" : "Không API key"}
                      </span>
                      {provider.isDefault ? (
                        <span className="rounded-full border-2 border-foreground bg-warning-soft px-2 py-1 text-xs font-extrabold">
                          Mặc định
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className={SECONDARY_ACTION_CLASS}
                      onClick={() =>
                        void adminUpdateAiProvider(
                          provider.id,
                          { isActive: !provider.isActive },
                          accessToken ?? undefined,
                        )
                          .then(load)
                          .catch((cause) => setError(getErrorMessage(cause)))
                      }
                    >
                      {provider.isActive ? "Tắt" : "Bật"}
                    </button>
                    {!provider.isDefault ? (
                      <button
                        className={PRIMARY_ACTION_CLASS}
                        onClick={() =>
                          void adminUpdateAiProvider(
                            provider.id,
                            { isDefault: true, isActive: true },
                            accessToken ?? undefined,
                          )
                            .then(load)
                            .catch((cause) => setError(getErrorMessage(cause)))
                        }
                      >
                        Đặt mặc định
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="space-y-5">
            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Coins className="h-6 w-6" />
                AI Credit
              </h2>
              <p className="font-semibold text-muted-foreground">
                Tìm người dùng và cấp credit; mọi lần cấp được ghi vào ledger.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className="flex gap-2"
            >
              <label className="sr-only" htmlFor="credit-search">
                Tìm người dùng
              </label>
              <input
                id="credit-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Email hoặc họ tên"
                className={INPUT_CLASS}
              />
              <button className={SECONDARY_ACTION_CLASS}>
                <Search className="h-5 w-5" />
                Tìm
              </button>
            </form>
            <div className="space-y-3">
              {users.map((user) => (
                <CreditUser
                  key={user.id}
                  user={user}
                  token={accessToken ?? undefined}
                  onGranted={async () => {
                    setNotice(`Đã cấp credit cho ${user.fullName}.`);
                    await load();
                  }}
                  onError={(cause) => setError(getErrorMessage(cause))}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ProviderForm({
  token,
  onCreated,
  onError,
}: {
  token?: string;
  onCreated: () => void;
  onError: (cause: unknown) => void;
}) {
  const [name, setName] = useState("Ollama local");
  const [kind, setKind] = useState<AiProviderKind>("ollama");
  const [baseUrl, setBaseUrl] = useState("http://host.docker.internal:11434");
  const [model, setModel] = useState("llama3.2");
  const [apiKey, setApiKey] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void adminCreateAiProvider(
          {
            name,
            kind,
            baseUrl,
            model,
            apiKey: apiKey || undefined,
            isActive: true,
          },
          token,
        )
          .then(onCreated)
          .catch(onError);
      }}
      className="grid gap-4 rounded-2xl border-2 border-foreground bg-secondary-soft p-5 shadow-brutal-md sm:grid-cols-2"
    >
      <Field label="Tên">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Loại">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AiProviderKind)}
          className={INPUT_CLASS}
        >
          <option value="ollama">Ollama</option>
          <option value="openai_compatible">OpenAI-compatible</option>
        </select>
      </Field>
      <Field label="Base URL">
        <input
          required
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Model">
        <input
          required
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="API key">
        <input
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
      <button className={`${PRIMARY_ACTION_CLASS} self-end`}>
        <Save className="h-5 w-5" />
        Lưu provider
      </button>
    </form>
  );
}
function CreditUser({
  user,
  token,
  onGranted,
  onError,
}: {
  user: AiCreditAdminUser;
  token?: string;
  onGranted: () => void;
  onError: (cause: unknown) => void;
}) {
  const [amount, setAmount] = useState(100);
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-extrabold">{user.fullName}</h3>
          <p className="text-sm font-semibold text-muted-foreground">
            {user.email || "Không có email"} · {user.role}
          </p>
        </div>
        <strong className="tabular-nums">
          {user.credit.available} khả dụng
        </strong>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void adminGrantAiCredit(
            { userId: user.id, amount, note: "Cấp từ Admin Console" },
            token,
          )
            .then(onGranted)
            .catch(onError);
        }}
        className="mt-3 flex gap-2"
      >
        <label className="sr-only" htmlFor={`amount-${user.id}`}>
          Số credit
        </label>
        <input
          id={`amount-${user.id}`}
          type="number"
          min={1}
          max={1000000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className={INPUT_CLASS}
        />
        <button className={PRIMARY_ACTION_CLASS}>Cấp</button>
      </form>
    </article>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="font-extrabold">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
