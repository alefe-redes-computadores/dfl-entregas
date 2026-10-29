"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteInboxPanel } from "@/components/store/SiteInboxPanel";
import { ReservationAuditPanel } from "@/components/store/ReservationAuditPanel";
import { FutureRoutePlanPanel } from "@/components/store/FutureRoutePlanPanel";
import { SitePlanningPreview } from "@/components/store/SitePlanningPreview";
import { OPERATION_FIRST_BATCH, nextProgressiveCount, progressiveCount } from '@/lib/operation/progressiveWindow';
import { classifyInboxDrafts, inboxViewDrafts, type InboxView } from '@/lib/operation/inboxPresentation';
import { searchInboxDrafts, inboxAttentionCounts } from '@/lib/operation/inbox-command-search';
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
import { toast } from '@/lib/operational-toast';
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import { useAppStore } from "@/store/useAppStore";
import { parseIfoodOrdersText } from "@/lib/ifood-order-parser";
import { isFood99Text, normalizeFood99Order } from '@/lib/food99-order';
import { knownOperationalNeighborhoods } from "@/lib/address-quality";
import { dateKey } from "@/lib/operational-time";
import {
  cleanupDeliveryInbox,
  createInboxDraft,
  dedupeInboxImport,
  loadInboxDay,
  recoverInterruptedInboxDrafts,
  saveInboxDay,
  type DeliveryInboxDraft,
} from "@/lib/delivery-inbox";

const sourceMeta = {
  ifood: { label: "iFood", icon: ShoppingBag },
  food99: { label: "99Food", icon: ShoppingBag },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  texto: { label: "Texto", icon: FileText },
};

export default function DeliveryInboxPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [channel,setChannel]=useState<'site'|'manual'>(params.get('aba')==='site'?'site':'manual');
  const focusedSiteOrder=params.get('pedido');
  useEffect(()=>{if(params.get('aba')==='site')setChannel('site');},[params]);

  const customers = useAppStore((state) => state.customers);
  const deliveries = useAppStore((state) => state.deliveries);

  const today = dateKey(new Date());

  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DeliveryInboxDraft[]>([]);
  const [processing, setProcessing] = useState(false);
  const importLock = useRef(false);
  const [view, setView] = useState<InboxView>('todos');
  const [inboxSearch,setInboxSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(OPERATION_FIRST_BATCH);
  useEffect(() => setVisibleLimit(OPERATION_FIRST_BATCH), [view, today]);

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

  const { active, ready, review, launched, discarded } = useMemo(
    () => classifyInboxDrafts(drafts), [drafts],
  );
  const viewFilteredDrafts = useMemo(
    () => inboxViewDrafts({ active, ready, review, launched, discarded }, view),
    [active, ready, review, launched, discarded, view],
  );
  const filteredDrafts = useMemo(() => searchInboxDrafts(viewFilteredDrafts,inboxSearch), [viewFilteredDrafts,inboxSearch]);
  const attentionCounts = useMemo(() => inboxAttentionCounts(active), [active]);
  useEffect(()=>setVisibleLimit(OPERATION_FIRST_BATCH),[inboxSearch]);
  const renderedDrafts = useMemo(
    () => filteredDrafts.slice(0, progressiveCount(filteredDrafts.length, visibleLimit)),
    [filteredDrafts, visibleLimit],
  );
  const knownCustomerNames = useMemo(() => customers.map((customer) => customer.name), [customers]);

  const processText = async () => {
    // Lock synchronously: the native haptic awaits before React can disable the button.
    if (importLock.current) return;
    const raw = text.trim();

    if (!raw) {
      toast.error("Cole um ou mais pedidos primeiro.");
      return;
    }

    importLock.current = true;
    setProcessing(true);

    try {
      if (Capacitor.isNativePlatform()) {
        void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
      }

      const parsedBase = parseIfoodOrdersText(raw, {
        knownNeighborhoods: neighborhoods,
        knownCustomerNames,
      });
      const parsed = isFood99Text(raw)
        ? parsedBase.map((order) => normalizeFood99Order(raw, order))
        : parsedBase;

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

      const { unique, skipped } = dedupeInboxImport(incoming, drafts);

      if (!unique.length) {
        toast.warning(
          "Esses itens já estão na Caixa de Entrada.",
        );
        return;
      }

      persist([...unique, ...drafts]);
      setText("");

      if (Capacitor.isNativePlatform()) {
        void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
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
          description: `${needsReview ? `${needsReview} precisam de revisão. ` : "Todos prontos para lançar. "}${skipped ? `${skipped} repetido(s) ignorado(s).` : ""}`,
        },
      );
    } finally {
      importLock.current = false;
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
        void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
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
    if (draft.status === 'launching' || draft.status === 'launched' || draft.status === 'discarded') return;
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


        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
        <nav aria-label="Fontes da Caixa de Entrada" className="grid grid-cols-2 gap-2">
          <button type="button" onClick={()=>setChannel('site')} aria-pressed={channel==='site'} className={`min-h-12 rounded-xl border text-xs font-black ${channel==='site'?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-zinc-800 text-zinc-400'}`}>Site</button>
          <button type="button" onClick={()=>setChannel('manual')} aria-pressed={channel==='manual'} className={`min-h-12 rounded-xl border text-xs font-black ${channel==='manual'?'border-violet-500/40 bg-violet-500/10 text-violet-200':'border-zinc-800 text-zinc-400'}`}>Importar</button>
        </nav>

        {channel==='site'?<>
          <SitePlanningPreview />
          <div className="space-y-3"><FutureRoutePlanPanel/><ReservationAuditPanel/><SiteInboxPanel focusedId={focusedSiteOrder}/></div></>:<div className="space-y-4">
        {/* R133_TRIAGEM_CAIXA: UI nao altera rascunhos nem importacao. */}
        <section aria-label="Triagem de pedidos importados" className="rounded-[20px] border border-sky-500/20 bg-sky-500/[.04] p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-zinc-950/60 p-2"><p className="text-lg font-black text-amber-300">{attentionCounts.review}</p><p className="text-[9px] text-zinc-400">Revisar</p></div>
            <div className="rounded-xl bg-zinc-950/60 p-2"><p className="text-lg font-black text-emerald-300">{attentionCounts.ready}</p><p className="text-[9px] text-zinc-400">Prontos</p></div>
            <div className="rounded-xl bg-zinc-950/60 p-2"><p className="text-lg font-black text-red-300">{attentionCounts.duplicates}</p><p className="text-[9px] text-zinc-400">Duplicados</p></div>
          </div>
          <div className="mt-3 flex gap-2">
            <input type="search" aria-label="Buscar rascunhos por cliente pedido ou endereco" value={inboxSearch}
              onChange={event=>setInboxSearch(event.target.value)}
              placeholder="Cliente, pedido, telefone, endereço..."
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500/50"/>
            {inboxSearch&&<button type="button" onClick={()=>setInboxSearch('')} className="min-h-12 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300">Limpar</button>}
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">Busca local nesta seleção. Nenhum pedido é alterado.</p>
        </section>
        <section className="overflow-hidden rounded-[24px] border border-violet-500/20 bg-gradient-to-br from-violet-500/[.10] via-zinc-900/70 to-zinc-950 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">
              <BrainCircuit size={20} />
            </div>

            <div>
              <h2 className="font-heading text-[15px] font-black">
                Cole seus pedidos
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Cole pedidos de iFood, 99Food ou mensagens. Revise antes de lançar;
                nada vira entrega automaticamente.
              </p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            rows={4}
            placeholder={
              "Cole um ou vários pedidos para analisar..."
            }
            className="mt-3 min-h-[112px] max-h-[38vh] w-full resize-y overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-violet-400/70"
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

        {launched.length > 0 && (
          <p role="status" className="px-1 text-[11px] font-semibold text-zinc-400">
            {launched.length} {launched.length === 1 ? 'pedido lançado' : 'pedidos lançados'} hoje
          </p>
        )}

        <nav aria-label="Filtrar rascunhos da Caixa de Entrada" className="grid grid-cols-3 gap-2">
          {([
            ['todos', 'Todos', active.length],
            ['revisar', 'Revisar', review.length],
            ['prontos', 'Prontos', ready.length],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`min-h-11 rounded-xl border px-1.5 text-[11px] font-black tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${view === key ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'}`}>
              {label} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </nav>

        {filteredDrafts.length === 0 ? (
          <section className="rounded-[20px] border border-dashed border-zinc-700/70 bg-zinc-900/25 px-4 py-7 text-center">
            <Inbox
              className="mx-auto text-zinc-500"
              size={28}
            />
            <h3 className="mt-3 text-sm font-black">
              {active.length === 0 ? 'Nenhum pedido aguardando' : 'Nada nesta seleção'}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              {active.length === 0
                ? 'Cole os pedidos acima; os rascunhos aparecerão aqui após a análise.'
                : 'Use Pendentes para consultar os demais pedidos.'}
            </p>
          </section>
        ) : (
          <section className="space-y-2.5">
            <p role="status" className="px-1 text-[10px] text-zinc-500">
              Exibindo {renderedDrafts.length} de {filteredDrafts.length} rascunhos nesta seleção
            </p>
            {renderedDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onLaunch={() => launch(draft)}
                onDiscard={() => discard(draft.id)}
              />
            ))}
            {filteredDrafts.length > renderedDrafts.length && (
              <button type="button" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/[.06] px-4 text-xs font-bold text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                onClick={() => setVisibleLimit((current) => nextProgressiveCount(filteredDrafts.length, current))}>
                Mostrar mais {Math.min(OPERATION_FIRST_BATCH, filteredDrafts.length - renderedDrafts.length)} de {filteredDrafts.length}
              </button>
            )}
          </section>
        )}

        {discarded.length > 0 && (
          <details className="rounded-2xl border border-zinc-900 bg-zinc-900/25 p-3">
            <summary className="cursor-pointer text-[10px] font-black text-zinc-600">
              Descartados hoje
            </summary>

            <div className="mt-2 space-y-2">
              {discarded.map((draft) => (
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
        </div>}
      </div>
    </main>
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
            <span className="text-[10px] font-black uppercase text-zinc-300">
              {meta.label}
            </span>

            {draft.confidence < 80 && (
              <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                Leitura {draft.confidence}% · conferir
              </span>
            )}

            {draft.status === 'launching' ? (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[8px] font-black text-violet-300">Aguardando retorno</span>
            ) : duplicate ? (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[8px] font-black text-red-400">
                Possível duplicado
              </span>
            ) : needsReview ? null : (
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
              (draft.source === 'food99' ? 'Entrega pela plataforma · endereço não obrigatório' : 'Endereço ainda não identificado')}
          </p>

          {(draft.parsed.orderId ||
            draft.parsed.ifoodId) && (
            <p className="mt-1 text-[9px] font-bold text-zinc-600">
              {draft.parsed.orderId &&
                `#${draft.parsed.orderId}`}
              {draft.parsed.orderId && draft.source === 'ifood' && draft.parsed.ifoodId
                ? " · "
                : ""}
              {draft.source === 'ifood' && draft.parsed.ifoodId &&
                `ID ${draft.parsed.ifoodId}`}
            </p>
          )}

          {(draft.parsed.customerCharge ||
            draft.parsed.value) && (
            <p className="mt-1 text-[11px] font-semibold text-zinc-300">
              Valor identificado: R$ {draft.parsed.customerCharge || draft.parsed.value}
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
        disabled={duplicate || draft.status === 'launching'}
        className="mt-3 flex h-10 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-[10px] font-black text-zinc-300 disabled:opacity-35 active:scale-[.99]"
      >
        <span>
          {draft.status === 'launching' ? 'Aguardando retorno' : needsReview
            ? "Abrir e revisar"
            : "Lançar entrega"}
        </span>
        <ChevronRight size={14} />
      </button>
    </article>
  );
}
