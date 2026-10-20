/**
 * R25: funcionários só podem entrar por ORIGEM HTTPS DEDICADA.
 * Nenhum domínio é liberado por padrão. O domínio administrativo é obrigatório
 * para impedir que um erro de configuração reutilize o armazenamento do owner.
 * Isto NÃO liga contas: Rules e flag de portal ainda são portões independentes.
 */
const configuredOrigin = (value: string | undefined): string | null => {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.origin !== raw || url.username || url.password) return null;
    if (!url.hostname.includes('.') || /^(?:localhost|127\.|0\.|10\.|192\.168\.)/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
};

export function isIsolatedStaffOrigin(
  currentOrigin: string,
  staffOrigin: string | undefined = process.env.NEXT_PUBLIC_DFL_STAFF_ORIGIN,
  ownerOrigin: string | undefined = process.env.NEXT_PUBLIC_DFL_OWNER_ORIGIN,
): boolean {
  const staff = configuredOrigin(staffOrigin);
  const owner = configuredOrigin(ownerOrigin);
  return Boolean(staff && owner && staff !== owner && currentOrigin === staff);
}
