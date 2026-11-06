import type { Delivery } from '@/types';

export type ManualMatchLevel = 'forte' | 'revisar' | 'nenhuma';
const normalizedName = (value?: string | null) => (value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
const digits = (value?: string | null) => (value || '').replace(/\D/g,'').slice(-11);
const cents = (v: number) => Number.isFinite(v) ? Math.round(v*100) : -1;
const dateMs = (d: Delivery) => Date.parse(d.created_at || d.createdAt || d.site_order_last_event_at || '');

/** Somente sugere conferência. NUNCA funde, arquiva, envia mensagens ou aloca rota. */
export function manualMatchLevel(site: Delivery, manual: Delivery, now = Date.now()): ManualMatchLevel {
  if (site.source_system !== 'dfl_site' || manual.source_system === 'dfl_site' || manual.origin !== 'loja') return 'nenhuma';
  if (manual.id === site.id) return 'nenhuma';
  const a=dateMs(site), b=dateMs(manual);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a-b)>24*3600_000 || Math.abs(now-b)>7*86400_000) return 'nenhuma';
  const sa=cents(Number(site.customer_charge ?? site.value));
  const sb=cents(Number(manual.customer_charge ?? manual.value));
  if (sa<0 || sb<0 || sa!==sb) return 'nenhuma';
  const p1=digits(site.phone), p2=digits(manual.phone);
  if (p1.length>=10 && p2.length>=10 && p1===p2) return 'forte';
  const n1=normalizedName(site.customer_name), n2=normalizedName(manual.customer_name);
  if (n1.length>=4 && n1===n2) return 'revisar';
  return 'nenhuma';
}

export function siteManualReviewCandidates(site: Delivery, manual: readonly Delivery[], now = Date.now()) {
  return manual.map(delivery=>({delivery,level:manualMatchLevel(site,delivery,now)}))
    .filter((row):row is {delivery:Delivery;level:'forte'|'revisar'}=>row.level!=='nenhuma')
    .sort((a,b)=>(a.level==='forte'?0:1)-(b.level==='forte'?0:1) ||
      (dateMs(b.delivery)||0)-(dateMs(a.delivery)||0)).slice(0,12);
}

/** Referência audível no Histórico do Site. Não declara quitação ou entrega. */
export function siteManualArchiveReason(manualId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(manualId)) throw new Error('Identificador manual inválido.');
  return `Pedido já lançado manualmente; ref-manual=${manualId}; sem duplicar rota`;
}
