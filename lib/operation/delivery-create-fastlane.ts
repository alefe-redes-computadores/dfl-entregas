/**
 * R227: navegação de endereço independente de geocodificação remota.
 * Nenhum endereço é alterado; um link informado pelo operador prevalece.
 * O link de pesquisa não é prova de posição geográfica nem substitui a revisão.
 */
export function deliverySearchMapLink(address: string, suppliedLink?: string): string {
  const typed = (suppliedLink || '').trim();
  if (typed) return typed;
  const clean = (address || '').trim();
  if (!clean) return '';
  const destination = /patos\s+de\s+minas/i.test(clean)
    ? clean : `${clean}, Patos de Minas - MG, Brasil`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}
