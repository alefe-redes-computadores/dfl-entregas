/** R75 P1: owner-only caller via the existing Entregas<->Site signing secret.
 * GET diagnostics does not send WhatsApp, wake workers, issue/reissue links or write to DB.
 */
import 'server-only';
import { createHmac } from 'node:crypto';
import { r75AuditUnavailable, r75ValidAuditEnvelope, type R75AuditView } from '../messagingAuditPolicyR75';
const allowHosts = new Set(['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app']);
const isDeliveryId = (x: string) => /^dfl-[A-Za-z0-9-]{12,120}$/.test(x);
export async function readManualProviderAudit(deliveryId: string): Promise<R75AuditView> {
  if (!isDeliveryId(deliveryId)) return r75AuditUnavailable('not_applicable');
  const rawUrl = process.env.DFL_SITE_INTEGRATION_URL?.trim() || '';
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim() || '';
  if (!rawUrl || secret.length < 24) return r75AuditUnavailable('not_configured');
  let target: string;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowHosts.has(url.hostname)) return r75AuditUnavailable('not_configured');
    target = `${url.origin}/api/integration/messaging-owner-audit`;
  } catch { return r75AuditUnavailable('not_configured'); }
  const eventId = `r75-owner-audit-v1__${deliveryId}`;
  const body = JSON.stringify({ event_id: eventId, source: 'manual', order_id: `entregas:${deliveryId}`, event_type: 'all' });
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  try {
    const res = await fetch(target, { method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
      signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json', 'x-dfl-timestamp': timestamp, 'x-dfl-signature': signature, 'x-dfl-event-id': eventId }, body });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) return r75AuditUnavailable('unavailable');
    const raw = await res.text();
    if (raw.length < 40 || raw.length > 12000) return r75AuditUnavailable('unavailable');
    const parsed: unknown = JSON.parse(raw);
    if (!r75ValidAuditEnvelope(parsed, deliveryId)) return r75AuditUnavailable('unavailable');
    return { status: 'ok', checkedAt: parsed.checkedAt, records: parsed.records, sampleLimited: parsed.sampleLimited, customerDeliveryVerified: false };
  } catch { return r75AuditUnavailable('unavailable'); }
}
