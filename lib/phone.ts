export function normalizeBrazilPhone(value?: string | null) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  // WhatsApp às vezes entrega DDD + número antigo com 8 dígitos.
  if (digits.length === 10) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  return digits;
}

export function formatBrazilPhone(value?: string | null) {
  // Input mask MUST NOT insert the 9th digit while typing: doing so on 10
  // digits causes the 11th character to be truncated or shifted on Android.
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
