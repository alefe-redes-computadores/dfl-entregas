/** R299 P6 — Identidade conservadora de convidados do Site.
 * Não contém IO, consultas, login, Firestore ou bloqueio comercial.
 * Apenas combina evidências inequívocas: nome completo, telefone brasileiro válido,
 * rua, número positivo, bairro e complemento (se informado).
 */
export type SiteGuestEvidence = {
  name?: string | null;
  phone?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  complement?: string | null;
};

const fold = (v?: string | null) => String(v || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR').trim();

export function canonicalSitePhone(v?: string | null): string | null {
  let s = String(v || '').replace(/\D/g, '');
  if (s.startsWith('55') && (s.length === 12 || s.length === 13)) s = s.slice(2);
  if (!/^[1-9][0-9][2-9][0-9]{7,8}$/.test(s)) return null;
  if (/^(\d)\1{7,}$/.test(s.slice(2))) return null;
  return s;
}

export function canonicalSiteName(v?: string | null): string | null {
  const s = fold(v).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || /^(?:cliente|consumidor|visitante|guest)(?:\s|$)/.test(s)) return null;
  const names = s.split(' ').filter(w => w.length >= 2);
  if (names.length < 2 || names[0].length < 3 || names[names.length - 1].length < 3) return null;
  return s;
}

const canonicalPart = (v?: string | null) => fold(v).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const canonicalStreet = (v?: string | null) => canonicalPart(v)
  .replace(/^r\s+/, 'rua ').replace(/^av\s+/, 'avenida ')
  .replace(/^aven\s+/, 'avenida ').replace(/^trav\s+/, 'travessa ');
const canonicalFullAddress = (v?: string | null) => canonicalStreet(v)
  .replace(/\b(?:n|no|num|numero)\s+(?=\d)/g, ' ')
  .replace(/\s+/g, ' ').trim();

export function siteGuestIdentityEvidence(input: SiteGuestEvidence): string | null {
  const name = canonicalSiteName(input.name);
  const phone = canonicalSitePhone(input.phone);
  const street = canonicalStreet(input.street);
  const district = canonicalPart(input.district);
  const number = canonicalPart(input.number).replace(/^(?:n|no|num|numero)\s+/, '');
  if (!name || !phone || street.length < 5 || district.length < 3) return null;
  if (!/^[1-9]\d{0,5}[a-z]?$/.test(number)) return null;
  // O complemento faz parte da chave: apartamento 1 não deve virar apartamento 2.
  return JSON.stringify(['v2', name, phone, street, number, district, canonicalPart(input.complement)]);
}

/** Compatibilidade de vinculação existente: telefone + nome completo + endereço idêntico.
 * Nome parecido, telefone compartilhado ou mesmo bairro jamais bastam.
 */
export function siteCustomerExistingEvidenceMatch(
  existing: { name?: string | null; phone?: string | null; address?: string | null },
  incoming: { name?: string | null; phone?: string | null; address?: string | null },
): boolean {
  const name = canonicalSiteName(incoming.name);
  const phone = canonicalSitePhone(incoming.phone);
  const address = canonicalFullAddress(incoming.address);
  return Boolean(name && phone && address &&
    canonicalSiteName(existing.name) === name &&
    canonicalSitePhone(existing.phone) === phone &&
    canonicalFullAddress(existing.address) === address);
}
