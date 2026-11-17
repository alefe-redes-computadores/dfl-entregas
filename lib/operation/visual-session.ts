/** R78: preferencias visuais de sessao. Nunca persistir dados comerciais ou autenticação. */
const KEY = 'dfl:r78:visual:';
export function readAccordionFlag(id: string): boolean | null {
  if (typeof window === 'undefined' || !/^[a-z0-9:_-]{1,120}$/i.test(id)) return null;
  try { const saved = window.sessionStorage.getItem(KEY + id); return saved === '1' ? true : saved === '0' ? false : null; }
  catch { return null; }
}
export function writeAccordionFlag(id: string, value: boolean): void {
  if (typeof window === 'undefined' || !/^[a-z0-9:_-]{1,120}$/i.test(id)) return;
  try { window.sessionStorage.setItem(KEY + id, value ? '1' : '0'); } catch { /* indisponivel */ }
}
