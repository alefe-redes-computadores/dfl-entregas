'use client';
/** Protocolo de homologação só do superadministrador. Compatível PWA e Android. */
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { isSuperadminUid } from './roles';
export type StaffStagingResponse = {
  ok?: boolean;
  error?: string;
  verified?: { uid: string; displayName: string; emailMasked: string; emailVerified: boolean };
  counts?: Record<string, number>;
  staged?: boolean;
  digest?: string;
  accountStatus?: string;
};
const DEFAULT_ORIGIN = 'https://dfl-entregas.vercel.app';
function endpoint(): string {
  if (!Capacitor.isNativePlatform()) return '/api/access/staging';
  const base = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN || DEFAULT_ORIGIN).trim().replace(/\/+$/,'');
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base)) throw new Error('Servidor de homologação inválido.');
  return `${base}/api/access/staging`;
}
export async function requestStaffStaging(
  operation: 'verify' | 'preview' | 'stage', draftId: string, targetUid: string, expectedDigest?: string,
): Promise<StaffStagingResponse> {
  const actor = auth.currentUser;
  if (!isSuperadminUid(actor?.uid)) throw new Error('Somente o superadministrador pode homologar contas.');
  const token = await actor!.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(endpoint(), {
      method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ operation, draftId, targetUid, ...(operation === 'stage' ? { confirmation: 'PREPARAR SEM LIBERAR LOGIN', expectedDigest } : {}) }),
    });
    if (!(response.headers.get('content-type') || '').includes('application/json')) {
      throw new Error(`Servidor respondeu conteúdo inesperado (${response.status}).`);
    }
    const body: StaffStagingResponse = await response.json();
    if (!response.ok || body.ok !== true) throw new Error(body.error || `Homologação indisponível (HTTP ${response.status}).`);
    return body;
  } finally {
    window.clearTimeout(timer);
  }
}
