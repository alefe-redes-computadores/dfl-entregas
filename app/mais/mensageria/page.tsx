'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';

type Reason = 'delivery_not_found' | string;
type Diagnostics = {
  ok: boolean;
  checkedAt: string;
  gates: {
    manualEnabled: boolean; manualActivationValid: boolean; manualSiteTargetConfigured: boolean;
    reverseRelayEnabled: boolean; reverseRelayConfigured: boolean;
  };
  reverseOutbox: Record<string, number>;
  issues: Array<{eventType:string;status:string;attempts:number;updatedAt:string;
    failure:{code:string;detail:string;retryable:boolean}}>;
  delivery: null | { present: boolean; created: Reason; routeStarted: Reason; completed: Reason; createdAfterActivation: boolean; sendingPermitted: boolean };
  note: string;
};
const reasonLabels: Record<string, string> = {
  eligible_by_policy: 'Apto pelas regras', delivery_not_found: 'Pedido não encontrado',
  delivery_id_invalid: 'Identificador inválido', source_not_manual: 'Pedido do Site ou marketplace',
  no_explicit_opt_in: 'Cliente não autorizou o WhatsApp', test_or_internal_order: 'Pedido interno/teste',
  not_dfl_delivery: 'Não é uma entrega DFL', phone_missing_or_invalid: 'Telefone ausente ou inválido',
  creation_not_current: 'Fora da janela de criação', route_not_recently_started: 'Rota ainda não iniciou ou saiu da janela',
  completion_not_current: 'Entrega ainda não concluída ou fora da janela',
};
function Gate({ title, yes, subtitle }: { title: string; yes: boolean; subtitle: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/75 p-3">
    <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
      {yes ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-amber-400" />}{title}
    </div>
    <p className="mt-1 text-[11px] text-zinc-400">{subtitle}</p>
  </div>;
}
export default function MensageriaDiagnosticPage() {
  const router = useRouter();
  const isOwner = isSuperadminUid(useAppStore(s => s.user?.uid));
  const [deliveryId, setDeliveryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Diagnostics | null>(null);
  const consult = async () => {
    if (!isOwner || busy) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão indisponível. Entre novamente.');
      const token = await user.getIdToken();
      const serverOrigin = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim() || 'https://dfl-entregas.vercel.app').replace(/\/+$/, '');
      const origin = Capacitor.isNativePlatform() ? serverOrigin : '';
      const id = deliveryId.trim();
      const url = `${origin}/api/integration/messaging-diagnostics${id ? `?deliveryId=${encodeURIComponent(id)}` : ''}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => null) as Diagnostics | null;
      if (!response.ok || !body?.ok || !body.gates) throw new Error('Não foi possível consultar os diagnósticos.');
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'AbortError'
        ? 'Tempo esgotado. A consulta anterior foi preservada.'
        : cause instanceof Error ? cause.message : 'Falha ao consultar.');
    } finally { window.clearTimeout(timer); setBusy(false); }
  };
  return <div className="dfl-page mx-auto max-w-3xl space-y-4 pb-20">
    <header className="space-y-2">
      <button type="button" onClick={() => router.push('/mais')} className="flex min-h-11 items-center gap-2 text-sm text-zinc-300"><ArrowLeft size={17}/> Voltar</button>
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-400"><ShieldCheck size={16}/> MSG-M4 · Diagnóstico seguro</p>
      <h1 className="font-heading text-2xl font-black text-zinc-50">Mensageria do Entregas</h1>
      <p className="text-xs leading-relaxed text-zinc-400">Veja por que um pedido não gerou aviso. Não envia WhatsApp, não reprocessa eventos e não modifica o banco.</p>
    </header>
    {isOwner && <button type="button" onClick={() => router.push('/mais/mensageria/homologacao')}
      className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-400/10 to-zinc-900 px-4 text-left text-xs font-black text-amber-200">
      <span className="flex items-center gap-2"><ShieldCheck size={17}/> Homologar ponte e bot com segurança</span>
      <span aria-hidden="true">›</span>
    </button>}
    {!isOwner ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><LockKeyhole size={16} className="inline"/> Diagnósticos disponíveis somente ao superadministrador.</p> : <>
      <section className="space-y-3 rounded-[22px] border border-zinc-800 bg-zinc-900/55 p-4">
        <label htmlFor="dfl-m4-id" className="block text-xs font-bold text-zinc-200">ID interno da entrega (opcional)</label>
        <input id="dfl-m4-id" type="text" autoComplete="off" spellCheck={false} value={deliveryId} onChange={event => setDeliveryId(event.target.value.slice(0,128))} placeholder="dfl-..." className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"/>
        <button type="button" onClick={() => void consult()} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50"><RefreshCw size={16}/>{busy ? 'Consultando…' : 'Verificar pontes e pedido'}</button>
        <p className="text-[11px] text-zinc-500">Sem ID, verifica apenas configurações e contagens. Sem consultas automáticas.</p>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </section>
      {data && <section className="space-y-3">
        <p className="flex items-center gap-2 text-[11px] text-zinc-400"><Clock3 size={14}/> Consultado em {new Date(data.checkedAt).toLocaleString('pt-BR')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Gate title="Avisos manuais" yes={data.gates.manualEnabled} subtitle={data.gates.manualEnabled ? 'Habilitação e data de início configuradas.' : 'OFF. Nenhuma mensagem manual será iniciada.'}/>
          <Gate title="Janela de ativação" yes={data.gates.manualActivationValid} subtitle="Exige data explícita; pedidos antigos permanecem excluídos."/>
          <Gate title="Destino manual do Site" yes={data.gates.manualSiteTargetConfigured} subtitle="Presença de configuração, sem revelar endereço ou segredo."/>
          <Gate title="Relay reverso logística" yes={data.gates.reverseRelayEnabled && data.gates.reverseRelayConfigured} subtitle="Ponte de eventos operacionais Site ↔ Entregas."/>
        </div>
        <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/55 p-4">
          <h2 className="mb-2 text-sm font-black text-zinc-100">Eventos da ponte logística</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{['pending','processing','failed','dead_letter'].map(key => <div key={key} className="rounded-xl bg-zinc-950 p-3"><strong className="block text-xl text-white">{data.reverseOutbox[key] ?? 0}</strong><small className="text-zinc-500">{key}</small></div>)}</div>
          <p className="mt-2 text-[11px] text-zinc-500">Totais de pendências da integração, não de mensagens entregues. Histórico sem dados pessoais.</p>
        </div>
        <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/55 p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-black text-zinc-100">Últimas falhas da ponte</h2><span className="text-[10px] text-zinc-500">12 eventos · sem dados pessoais</span></div>
          {!data.issues?.length ? <p className="text-xs text-zinc-500">Nenhuma pendência encontrada nesta amostra.</p> :
            <div className="space-y-2">{data.issues.map((issue,index)=><div key={`${issue.eventType}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong className="text-zinc-100">{issue.eventType.replace(/[_\.]/g,' ')}</strong><span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-amber-300">{issue.status}</span></div>
              <p className="mt-1 text-[11px] text-zinc-300">{issue.failure.detail}</p>
              <p className="mt-1 text-[10px] text-zinc-500">Tentativas automáticas: {issue.attempts}. {issue.failure.retryable?'Falha aparentemente transitória.':'Sem reenvio automático pela tela.'}</p>
            </div>)}</div>}
          <p className="mt-3 text-[11px] text-amber-200">Não existe botão de repetição em massa. Falha de configuração exige correção, não novos envios.</p>
        </div>
        {data.delivery && <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/55 p-4">
          <h2 className="text-sm font-black text-white">Elegibilidade do pedido consultado</h2>
          {!data.delivery.present ? <p className="mt-2 text-xs text-amber-300">Pedido não encontrado.</p> : <>
            <p className="mt-2 text-xs text-zinc-300">Criado após ativação: {data.delivery.createdAfterActivation ? 'Sim' : 'Não'}</p>
            <div className="mt-3 space-y-2">{([['Cadastro',data.delivery.created],['Saída da rota',data.delivery.routeStarted],['Conclusão',data.delivery.completed]] as const).map(([title,value]) => <div key={title} className="flex items-start justify-between gap-2 rounded-xl bg-zinc-950 p-3 text-xs"><strong>{title}</strong><span className="text-right text-zinc-400">{reasonLabels[value] || value.replace(/_/g,' ')}</span></div>)}</div>
            <p className="mt-2 text-[11px] text-amber-300">Mesmo apto pelas regras, só pode enviar com ambas as pontes ativadas e serviço do WhatsApp validado.</p>
          </>}
        </div>}
      </section>}
      <p className="text-[11px] text-zinc-500">Não mostra telefone completo, conteúdo de mensagens, segredos nem dados financeiros. Aceito na fila não equivale a recebido pelo cliente.</p>
    </>}
  </div>;
}
