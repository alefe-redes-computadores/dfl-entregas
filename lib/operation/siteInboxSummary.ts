/** Compact actionable labels; never present four zero-valued categories. */
export type SiteInboxCounts = Readonly<{ready:number; commercial:number; scheduled:number; review:number}>;
export function siteInboxSummary(counts: SiteInboxCounts): string {
  const entries: string[] = [];
  if (counts.ready > 0) entries.push(`${counts.ready} pronto${counts.ready === 1 ? '' : 's'} para rota`);
  if (counts.commercial > 0) entries.push(`${counts.commercial} aguardando o Site`);
  if (counts.scheduled > 0) entries.push(`${counts.scheduled} agendado${counts.scheduled === 1 ? '' : 's'}`);
  if (counts.review > 0) entries.push(`${counts.review} para revisar`);
  return entries.length ? entries.join(' · ') : 'Nenhum pedido aguardando organização';
}
