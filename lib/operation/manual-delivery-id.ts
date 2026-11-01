/**
 * R232 — identificador local forte para uma entrega criada manualmente.
 * IDs comerciais de plataformas NÃO são gerados aqui: a store mantém
 * deliveryImportDocumentId como autoridade de importação/idempotência.
 */
let fallbackSequence = 0;

export function createManualDeliveryId(): string {
  // O formato é uma string opaca. Nunca usar hora do relógio como chave única.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dfl-${crypto.randomUUID()}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `dfl-${hex}`;
  }
  // WebViews antigos: contador de sessão + entropia; não depende só de Date.now().
  fallbackSequence = (fallbackSequence + 1) >>> 0;
  return `dfl-${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2, 13)}`;
}
