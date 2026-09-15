import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return applicationDefault();

  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contém JSON inválido.');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON incompleto.');
  }

  return cert({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
  });
}

const adminApp = getApps()[0] || initializeApp({ credential: credential() });
export const adminDb = getFirestore(adminApp);
