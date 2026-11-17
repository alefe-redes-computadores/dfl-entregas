'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** R78: restaura o ponto anterior ao voltar de outra pagina, sem historico remoto. */
export function OperationalScrollMemory() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'dfl:r78:scroll:' + pathname + window.location.search;
    let value = 0;
    try { value = Number(window.sessionStorage.getItem(key) || 0); } catch { /* storage opcional */ }
    const target = Number.isFinite(value) && value > 0 ? Math.min(value, 100000) : 0;
    let restoring = target > 0;
    let cancelled = false;
    let retry: number | undefined;
    let attempts = 0;
    const save = () => {
      if (restoring) return;
      try { window.sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch { /* opcional */ }
    };
    const restore = () => {
      if (cancelled || !restoring) return;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(target, max), behavior: 'auto' });
      attempts++;
      if (max >= target - 3 || attempts >= 12) { restoring = false; save(); return; }
      retry = window.setTimeout(restore, 160);
    };
    if (restoring) retry = window.setTimeout(restore, 80);
    const interrupted = () => { restoring = false; if (retry !== undefined) window.clearTimeout(retry); };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    window.addEventListener('touchstart', interrupted, { passive: true });
    window.addEventListener('wheel', interrupted, { passive: true });
    return () => {
      cancelled = true;
      if (retry !== undefined) window.clearTimeout(retry);
      restoring = false;
      save();
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
      window.removeEventListener('touchstart', interrupted);
      window.removeEventListener('wheel', interrupted);
    };
  }, [pathname]);
  return null;
}
