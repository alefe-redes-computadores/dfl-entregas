'use client';
/** Ação exclusivamente administrativa, com validação de resposta HTTP+JSON. */
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { isSuperadminUid } from './roles';

const FALLBACK_ORIGIN = 'https://dfl-entregas.vercel.app';
export interface RevocationResponse {
  ok: boolean;
  error?: string;
  account?: { uid:string; displayName:string; role:string; status:string; updatedAt:string };
  suspended?: boolean;
  removed?: number;
  warnings?: string[];
}
function endpoint() {
  if (!Capacitor.isNativePlatform()) return '/api/access/revoke';
  const origin = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN || FALLBACK_ORIGIN).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)) throw new Error('Servidor administrativo inválido.');
  return `${origin}/api/access/revoke`;
}
export async function staffRevocationRequest(
  operation: 'inspect' | 'revoke', targetUid: string, expectedUpdatedAt?: string,
): Promise<RevocationResponse> {
  const user = auth.currentUser;
  if (!isSuperadminUid(user?.uid)) throw new Error('Somente o superadministrador pode revogar acessos.');
  const token = await user!.getIdToken(true);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(endpoint(), {
      method:'POST',
      cache:'no-store', credentials:'omit', signal:controller.signal,
      headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({operation,targetUid, ...(operation==='revoke' ? {expectedUpdatedAt,confirmation:'REVOGAR E LIMPAR ACESSO'} : {})}),
    });
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
      throw new Error(`Servidor não retornou JSON (HTTP ${res.status}).`);
    }
    const data = await res.json() as RevocationResponse;
    if ((!res.ok && res.status!==207) || (data.ok!==true && data.suspended!==true)) {
      throw new Error(data.error || `Operação indisponível (HTTP ${res.status}).`);
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}
