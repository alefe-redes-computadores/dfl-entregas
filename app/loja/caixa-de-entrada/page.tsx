"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardPaste,
  Inbox,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  MessageCircle,
  ShoppingBag,
  FileText,
  ShieldCheck,
  X,
  BrainCircuit,
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import { useAppStore } from "@/store/useAppStore";
import { parseIfoodOrdersText } from "@/lib/ifood-order-parser";
import { knownOperationalNeighborhoods } from "@/lib/address-quality";
import { dateKey } from "@/lib/operational-time";
import {
  cleanupDeliveryInbox,
  createInboxDraft,
  loadInboxDay,
  recoverInterruptedInboxDrafts,
  saveInboxDay,
  type DeliveryInboxDraft,
} from "@/lib/delivery-inbox";

const sourceMeta = {
  ifood: { label: "iFood", icon: ShoppingBag },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  texto: { label: "Texto", icon: FileText },
};

export default function DeliveryInboxPage() {
  const router = useRouter();

  const customers = useAppStore((state) => state.customers);
  const deliveries = useAppStore((state) => state.deliveries);

  const today = dateKey(new Date());

  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DeliveryInboxDraft[]>([]);
  const [processing, setProcessing] = useState(false);

  const neighborhoods = useMemo(
    () =>
      knownOperationalNeighborhoods(
        customers.flatMap((customer) => [
          customer.neighborhood,
          customer.address,
        ]),
      ),
    [customers],
  );

  useEffect(() => {
    cleanupDeliveryInbox(today);

    const recovered = recoverInterruptedInboxDrafts(
      loadInboxDay(today),
    );

    saveInboxDay(recovered);
    setDrafts(recovered.drafts);
  }, [today]);

  const persist = (next: DeliveryInboxDraft[]) => {
    setDrafts(next);
    saveInboxDay({
      version: 1,
      dayKey: today,
      drafts: next,
    });
  };

  const active = drafts.filter(
    (draft) =>
      draft.status !== "discarded" &&
      draft.status !== "launched",
  );

  const ready = active.filter(
    (draft) => draft.status === "ready",
  );

  const review = active.filter(
    (draft) => draft.status === "review",
  );

  const launched = drafts.filter(
    (draft) => draft.status === "launched",
  );

  const processText = async () => {
    const raw = text.trim();

    if (!raw) {
      toast.error("Cole um ou mais pedidos primeiro.");
      return;
    }

    setProcessing(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({
          style: ImpactStyle.Medium,
        });
      }

      const parsed = parseIfoodOrdersText(raw, {
        knownNeighborhoods: neighborhoods,
        knownCustomerNames: customers.map(
          (customer) => customer.name,
        ),
      });

      if (!parsed.length) {
        toast.error("Não consegui separar nenhum pedido.", {
          description:
            "O texto continua aqui para você ajustar sem perder nada.",
        });
        return;
      }

      const incoming = parsed.map((order, index) =>
        createInboxDraft(
          order,
          raw,
          today,
          deliveries,
          index,
        ),
      );

      const existingKeys = new Set(
        drafts.map(
          (draft) =>
            `${draft.parsed.ifoodId}|${draft.parsed.orderId}|${draft.rawText}`,
        ),
      );

      const unique = incoming.filter(
        (draft) =>
          !existingKeys.has(
            `${draft.parsed.ifoodId}|${draft.parsed.orderId}|${draft.rawText}`,
          ),
      );

      if (!unique.length) {
        toast.warning(
          "Esses itens já estão na Caixa de Entrada.",
        );
        return;
      }

      persist([...unique, ...drafts]);
      setText("");

      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({
          style: ImpactStyle.Heavy,
        });
      }

      const needsReview = unique.filter(
        (item) => item.status === "review",
      ).length;

      toast.success(
        `${unique.length} ${
          unique.length === 1
            ? "rascunho criado"
            : "rascunhos criados"
        }.`,
        {
          description: needsReview
            ? `${needsReview} precisam de revisão antes do lançamento.`
            : "Todos estão prontos para lançar.",
        },
      );
    } finally {
      setProcessing(false);
    }
  };

  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText();

      if (!value) {
        toast.info("A área de transferência está vazia.");
        return;
      }

      setText(value);

      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({
          style: ImpactStyle.Light,
        });
      }

      toast.success(
        "Texto colado. Agora toque em Analisar.",
      );
    } catch {
      toast.error(
        "Não consegui ler a área de transferência.",
      );
    }
  };

  const launch = (draft: DeliveryInboxDraft) => {
    if (draft.duplicateDeliveryId) {
      toast.warning("Possível duplicado bloqueado.", {
        description: draft.duplicateReason,
      });
      return;
    }

    persist(
      drafts.map((item) =>
        item.id === draft.id
          ? { ...item, status: "launching" as const }
          : item,
      ),
    );

    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({
        style: ImpactStyle.Medium,
      });
    }

    router.push(
      `/entregas/nova?inboxDraft=${encodeURIComponent(
        draft.id,
      )}&inboxDay=${encodeURIComponent(
        today,
      )}&returnTo=${encodeURIComponent(
        "/loja/caixa-de-entrada",
      )}`,
    );
  };

  const discard = (id: string) => {
    const before = drafts;

    persist(
      drafts.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "discarded" as const,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    toast.info("Rascunho descartado.", {
      action: {
        label: "Desfazer",
        onClick: () => persist(before),
      },
    });
  };

  const restore = (id: string) => {
    persist(
      drafts.map((item) =>
        item.id === id
          ? {
              ...item,
              status:
                item.missingFields.length > 0 ||
                item.duplicateDeliveryId
                  ? ("review" as const)
                  : ("ready" as const),
            }
          : item,
      ),
    );
  };

  return (
    <main className="min-h-dvh bg-zinc-950 pb-28 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/92 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            onClick={() => router.replace("/loja")}
            className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-violet-400">
              Operação de hoje
            </p>
            <h1 className="font-heading text-lg font-black">
              Caixa de Entrada
            </h1>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-center">
            <p className="text-sm font-black">
              {active.length}
            </p>
            <p className="text-[8px] font-bold uppercase text-zinc-500">
              pendentes
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-3.5">
        <section className="overflow-hidden rounded-[24px] border border-violet-500/20 bg-gradient-to-br from-violet-500/[.10] via-zinc-900/70 to-zinc-950 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">
              <BrainCircuit size={20} />
            </div>

            <div>
              <h2 className="font-heading text-[15px] font-black">
                Jogue os pedidos aqui
              </h2>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                iFood, WhatsApp ou texto livre. Nada vira
                entrega, cliente ou financeiro até você
                confirmar o lançamento.
              </p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            rows={6}
            placeholder={
              "Cole um ou vários pedidos...\n\nO cérebro separa, identifica e sinaliza o que precisa de revisão."
            }
            className="mt-4 w-full resize-none rounded-2xl border border-zinc-800 bg-black/25 p-3 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-violet-500/40"
          />

          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
            <button
              onClick={paste}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-[10px] font-black text-zinc-300 active:scale-[.98]"
            >
              <ClipboardPaste size={15} />
              Colar
            </button>

            <button
              disabled={processing || !text.trim()}
              onClick={processText}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-[11px] font-black text-white disabled:opacity-40 active:scale-[.98]"
            >
              <Sparkles size={15} />
              {processing
                ? "Analisando..."
                : "Analisar pedidos"}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Stat
            label="Prontos"
            value={ready.length}
            tone="emerald"
          />
          <Stat
            label="Revisar"
            value={review.length}
            tone="amber"
          />
          <Stat
            label="Lançados"
            value={launched.length}
            tone="zinc"
          />
        </section>

        {active.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900/25 p-8 text-center">
            <Inbox
              className="mx-auto text-zinc-700"
              size={28}
            />
            <h3 className="mt-3 text-sm font-black">
              Caixa limpa
            </h3>
            <p className="mt-1 text-[10px] text-zinc-600">
              Os próximos textos analisados aparecem aqui
              como rascunhos.
            </p>
          </section>
        ) : (
          <section className="space-y-2.5">
            {active.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onLaunch={() => launch(draft)}
                onDiscard={() => discard(draft.id)}
              />
            ))}
          </section>
        )}

        {drafts.some(
          (draft) => draft.status === "discarded",
        ) && (
          <details className="rounded-2xl border border-zinc-900 bg-zinc-900/25 p-3">
            <summary className="cursor-pointer text-[10px] font-black text-zinc-600">
              Descartados hoje
            </summary>

            <div className="mt-2 space-y-2">
              {drafts
                .filter(
                  (draft) =>
                    draft.status === "discarded",
                )
                .map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => restore(draft.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-zinc-950 p-3 text-left text-[10px] text-zinc-500"
                  >
                    <span className="truncate">
                      {draft.parsed.customerName ||
                        draft.parsed.address ||
                        "Rascunho"}
                    </span>
                    <RotateCcw size={13} />
                  </button>
                ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "zinc";
}) {
  const className =
    tone === "emerald"
      ? "border-emerald-500/15 bg-emerald-500/[.05] text-emerald-400"
      : tone === "amber"
        ? "border-amber-500/15 bg-amber-500/[.05] text-amber-400"
        : "border-zinc-800 bg-zinc-900/45 text-zinc-400";

  return (
    <div
      className={`rounded-2xl border p-3 ${className}`}
    >
      <p className="text-lg font-black">{value}</p>
      <p className="text-[8px] font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
    </div>
  );
}

function DraftCard({
  draft,
  onLaunch,
  onDiscard,
}: {
  draft: DeliveryInboxDraft;
  onLaunch: () => void;
  onDiscard: () => void;
}) {
  const meta = sourceMeta[draft.source];
  const Icon = meta.icon;
  const duplicate = Boolean(
    draft.duplicateDeliveryId,
  );
  const needsReview =
    draft.missingFields.length > 0;

  return (
    <article
      className={`rounded-[22px] border p-3.5 ${
        duplicate
          ? "border-red-500/20 bg-red-500/[.035]"
          : needsReview
            ? "border-amber-500/20 bg-amber-500/[.035]"
            : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-zinc-400">
          <Icon size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black uppercase text-zinc-500">
              {meta.label}
            </span>

            <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[8px] font-black text-zinc-500">
              {draft.confidence}% leitura
            </span>

            {duplicate ? (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[8px] font-black text-red-400">
                Possível duplicado
              </span>
            ) : needsReview ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-black text-amber-400">
                Revisar
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black text-emerald-400">
                Pronto
              </span>
            )}
          </div>

          <h3 className="mt-1.5 truncate text-sm font-black">
            {draft.parsed.customerName ||
              "Cliente não identificado"}
          </h3>

          <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
            {draft.parsed.address ||
              "Endereço ainda não identificado"}
          </p>

          {(draft.parsed.orderId ||
            draft.parsed.ifoodId) && (
            <p className="mt-1 text-[9px] font-bold text-zinc-600">
              {draft.parsed.orderId &&
                `#${draft.parsed.orderId}`}
              {draft.parsed.orderId &&
              draft.parsed.ifoodId
                ? " · "
                : ""}
              {draft.parsed.ifoodId &&
                `ID ${draft.parsed.ifoodId}`}
            </p>
          )}

          {(draft.parsed.customerCharge ||
            draft.parsed.value) && (
            <p className="mt-1 text-[9px] text-zinc-600">
              Valor detectado: R${" "}
              {draft.parsed.customerCharge ||
                draft.parsed.value}{" "}
              · ainda não lançado
            </p>
          )}
        </div>

        <button
          onClick={onDiscard}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-700 active:bg-red-500/10 active:text-red-400"
        >
          <X size={14} />
        </button>
      </div>

      {(duplicate || needsReview) && (
        <div
          className={`mt-3 flex gap-2 rounded-xl p-2.5 text-[9px] leading-relaxed ${
            duplicate
              ? "bg-red-500/[.06] text-red-300"
              : "bg-amber-500/[.06] text-amber-300"
          }`}
        >
          {duplicate ? (
            <ShieldCheck
              size={13}
              className="shrink-0"
            />
          ) : (
            <AlertTriangle
              size={13}
              className="shrink-0"
            />
          )}

          <span>
            {duplicate
              ? draft.duplicateReason
              : `Falta revisar: ${draft.missingFields.join(
                  ", ",
                )}.`}
          </span>
        </div>
      )}

      <button
        onClick={onLaunch}
        disabled={duplicate}
        className="mt-3 flex h-10 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-[10px] font-black text-zinc-300 disabled:opacity-35 active:scale-[.99]"
      >
        <span>
          {needsReview
            ? "Abrir e revisar"
            : "Lançar entrega"}
        </span>
        <ChevronRight size={14} />
      </button>
    </article>
  );
}
