/**
 * V107 — Evidência do relay reverso, não comprovante de WhatsApp.
 * Funções puras para uso do servidor e apresentação, sem efeito colateral.
 */
export type TraceEvent = {
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  occurredAt: string | null;
  processedAt: string | null;
  lastError: string | null;
};

export type RelayVerdict =
  | 'site_accepted'
  | 'relay_failed'
  | 'relay_pending'
  | 'no_event'
  | 'no_terminal_event';

export type TraceSummary = {
  verdict: RelayVerdict;
  headline: string;
  detail: string;
  whatsapp: 'not_verified';
  sent: number;
  pending: number;
  failed: number;
};

const RELEVANT = new Set([
  'delivery.out_for_delivery',
  'delivery.next_stop',
  'delivery.completed',
  'delivery.failed',
]);

export function traceSummary(events: TraceEvent[], completed: boolean): TraceSummary {
  const relevant = events.filter(event => RELEVANT.has(event.eventType));
  const sent = relevant.filter(event => event.status === 'sent').length;
  const failed = relevant.filter(event => event.status === 'failed' || event.status === 'dead_letter').length;
  const pending = relevant.filter(event => event.status === 'pending' || event.status === 'processing').length;
  const terminal = relevant.filter(event => event.eventType === 'delivery.completed');
  const base = { whatsapp: 'not_verified' as const, sent, failed, pending };

  if (failed) return { ...base, verdict: 'relay_failed', headline: 'Falha no envio ao Site', detail: 'Há eventos com erro ou bloqueados na fila reversa. Examine o erro e o número de tentativas.' };
  if (pending) return { ...base, verdict: 'relay_pending', headline: 'Sincronização ainda pendente', detail: 'Há evento aguardando processamento ou em execução na fila Entregas → Site.' };
  if (completed && !terminal.length) return { ...base, verdict: 'no_terminal_event', headline: 'Conclusão sem evento observado', detail: 'Entrega concluída, mas a amostra da fila não mostrou delivery.completed. Conferir reconciliador e limite da consulta.' };
  if (sent) return { ...base, verdict: 'site_accepted', headline: 'Site aceitou o evento', detail: 'O Site respondeu com sucesso ao relay; isso NÃO confirma que o bot enviou ou que o cliente recebeu WhatsApp.' };
  return { ...base, verdict: 'no_event', headline: 'Nenhum evento logístico encontrado', detail: 'Não encontramos eventos relevantes na consulta limitada. Pode ser pedido sem evento esperado, sincronização não iniciada ou amostra incompleta.' };
}
