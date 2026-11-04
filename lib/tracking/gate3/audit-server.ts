/** Server-side owner-only read audit. Bounded, no writes and no side effects. */
import 'server-only';
import { inspectConfirmedOwnerDelivery } from '../gate1/owner-inspection';
import { certifyInspection } from '../gate2/certification';
import { auditRow, failedAuditRow, summarizeAudit, type AuditRow, type AuditSummary } from './batch-audit';

export async function runOwnerBatchAudit(ids: readonly string[]): Promise<AuditSummary> {
  if(ids.length < 1 || ids.length > 20)throw new Error('invalid-batch');
  // Three readers at most: responsive without creating a Firestore burst.
  const rows: AuditRow[]=new Array(ids.length);
  let cursor=0;
  const workers=Array.from({length:Math.min(3,ids.length)},async()=>{
    while(cursor<ids.length){
      const index=cursor++;
      const id=ids[index];
      try{
        const inspection=await inspectConfirmedOwnerDelivery(id);
        rows[index]=auditRow(id,inspection,inspection?certifyInspection(inspection):undefined);
      }catch{
        // Never return an error body with private snapshots or stack traces.
        rows[index]=failedAuditRow(id);
      }
    }
  });
  await Promise.all(workers);
  return summarizeAudit(rows);
}
