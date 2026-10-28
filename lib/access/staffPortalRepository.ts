/** Acesso separado do useAppStore: nunca hidratar colecoes gerais para funcionario. */
import {
  collection, doc, getDocFromServer, getDocsFromServer, limit, query,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  STAFF_AREAS, decodeStaffRow, mayReadStaffArea, parseStaffAccount,
  type StaffAccount, type StaffArea, type StaffRow,
} from './staffRuntime';
import { isSuperadminUid } from './roles';

function assertIdentity(uid: string) {
  if (isSuperadminUid(uid) || auth.currentUser?.uid !== uid || !/^[a-zA-Z0-9_-]{8,128}$/.test(uid)) {
    throw new Error('Identidade de funcionário inválida.');
  }
}
export function staffAccountRef(uid: string) {
  assertIdentity(uid);
  return doc(db, 'staff_accounts', uid);
}
export async function fetchStaffAccount(uid: string): Promise<StaffAccount | null> {
  const snap = await getDocFromServer(staffAccountRef(uid));
  return snap.exists() ? parseStaffAccount(snap.data(), uid) : null;
}
export async function fetchStaffRows(uid: string, area: StaffArea, account: StaffAccount): Promise<StaffRow[]> {
  assertIdentity(uid);
  if (!STAFF_AREAS.includes(area) || account.uid !== uid || !mayReadStaffArea(account, area)) throw new Error('Acesso não autorizado para esta área.');
  const snap = await getDocsFromServer(query(collection(db, 'staff_workspaces', uid, area), limit(40)));
  assertIdentity(uid);
  return snap.docs.map((item) => decodeStaffRow(item.data(), item.id));
}
