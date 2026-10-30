/** DFL_R202_LEGACY_AUDIT — Projeção local; zero consultas, escritas ou mutações. */
import type { Delivery } from '@/types';
import { deliveryImportDocumentId } from '@/lib/operation/delivery-import-identity';

export type ImportAuditKind = 'confirmada_por_identidade' | 'suspeita_por_numero';
export type ImportAuditGroup = {
  key: string;
  kind: ImportAuditKind;
  channel: 'ifood' | 'food99';
  documentIds: string[];
  legacyCount: number;
  canonicalCount: number;
};
export type ImportAuditReport = {
  total: number;
  canonical: number;
  legacy: number;
  unidentified: number;
  groups: ImportAuditGroup[];
  strongGroups: number;
  reviewGroups: number;
  affectedDocuments: number;
};

type AuditDelivery = Pick<Delivery, 'id' | 'origin' | 'source_system' | 'ifood_id' | 'order_id' | 'created_at' | 'createdAt'>;

const clean = (value: unknown) => String(value || '').trim();
const digits = (value: unknown) => clean(value).replace(/\D/g, '');

/** Data precisa pertencer ao próprio registro, nunca ao dia atual do aparelho. */
export function importLocalDay(item: AuditDelivery): string | null {
  const raw = clean(item.created_at || item.createdAt);
  if (!raw) return null;
  const when = new Date(raw);
  if (!Number.isFinite(when.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',year: 'numeric', month: '2-digit',day: '2-digit',
  }).formatToParts(when);
  const part = (key: string) => parts.find(value => value.type === key)?.value || '';
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function auditLegacyImports(items: readonly AuditDelivery[]): ImportAuditReport {
  type Candidate = { id: string; canonical: boolean };
  const strong = new Map<string, Candidate[]>();
  const review = new Map<string, Candidate[]>();
  let total = 0, canonical = 0, legacy = 0, unidentified = 0;
  const append = (bucket: Map<string,Candidate[]>, key: string, candidate: Candidate) => {
    const group = bucket.get(key) || [];
    if (!group.some(value=>value.id===candidate.id)) group.push(candidate);
    bucket.set(key,group);
  };
  for (const item of items) {
    if (item.source_system === 'dfl_site' || (item.origin !== 'ifood' && item.origin !== 'food99')) continue;
    total++;
    const expected = deliveryImportDocumentId(item);
    const isCanonical = Boolean(expected && item.id === expected);
    if (isCanonical) canonical++; else legacy++;
    const candidate = { id: item.id, canonical: isCanonical };
    const day = importLocalDay(item);
    const order = clean(item.order_id).replace(/^#/,'').toLowerCase();
    const ifoodId = digits(item.ifood_id);
    if (item.origin === 'ifood') {
      if (/^\d{6,32}$/.test(ifoodId)) append(strong,`ifood:id:${ifoodId}`,candidate);
      // Mesmos números curtos nem sempre são o mesmo pedido: só revisão humana.
      if (day && /^[a-z0-9]{1,32}$/.test(order)) append(review,`ifood:numero:${order}:${day}`,candidate);
      if (!/^\d{6,32}$/.test(ifoodId) && !(day && /^[a-z0-9]{1,32}$/.test(order))) unidentified++;
    } else {
      if (day && /^\d{6}$/.test(order)) append(strong,`food99:numero:${order}:${day}`,candidate);
      else unidentified++;
    }
  }
  const groups: ImportAuditGroup[] = [];
  const collect = (bucket: Map<string,Candidate[]>,kind:ImportAuditKind) => {
    for (const [key,group] of bucket) {
      if (group.length < 2) continue;
      // A suspeita do iFood deixa de contar pares já cobertos por identidade forte.
      if (kind === 'suspeita_por_numero' && groups.some(value =>
        value.kind === 'confirmada_por_identidade' &&
        group.every(item=>value.documentIds.includes(item.id)))) continue;
      groups.push({key,kind,channel:key.startsWith('food99:')?'food99':'ifood',
        documentIds:group.map(item=>item.id),
        legacyCount:group.filter(item=>!item.canonical).length,
        canonicalCount:group.filter(item=>item.canonical).length});
    }
  };
  collect(strong,'confirmada_por_identidade');
  collect(review,'suspeita_por_numero');
  groups.sort((a,b) => (a.kind===b.kind ? a.key.localeCompare(b.key) : a.kind==='confirmada_por_identidade'?-1:1));
  const affectedIds = new Set(groups.flatMap(group=>group.documentIds));
  return {total,canonical,legacy,unidentified,groups,
    strongGroups:groups.filter(group=>group.kind==='confirmada_por_identidade').length,
    reviewGroups:groups.filter(group=>group.kind==='suspeita_por_numero').length,
    affectedDocuments:affectedIds.size};
}

/** Relatório copiável NÃO inclui nomes, telefones, endereços ou valores. */
export function legacyAuditText(report: ImportAuditReport): string {
  const lines=[
    'DFL R202 — auditoria local de importação (sem consultas extras)',
    `Plataformas: ${report.total}; documentos R201: ${report.canonical}; legados: ${report.legacy}; identidade incompleta: ${report.unidentified}`,
    `Colisões fortes: ${report.strongGroups}; suspeitas: ${report.reviewGroups}; documentos para conferir: ${report.affectedDocuments}`,
    'Não apague nem una pedidos sem conferir histórico, pagamentos, rotas e status remoto.',
  ];
  for (const group of report.groups.slice(0,40)) {
    const safeKey = group.key.replace(/[^a-zA-Z0-9:_-]/g,'');
    const safeIds = group.documentIds.slice(0,12).map(id=>id.replace(/[^a-zA-Z0-9_-]/g,'')).join(', ');
    lines.push(`${group.kind} | ${safeKey} | docs: ${safeIds}${group.documentIds.length>12?' (+outros)':''}`);
  }
  if(report.groups.length>40) lines.push(`Mais ${report.groups.length-40} grupos omitidos desta cópia.`);
  lines.push('Regras Firestore publicadas e colisões entre aparelhos NÃO são comprovadas por esta tela.');
  return lines.join('\n');
}
