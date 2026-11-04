/** Owner-read-only, never enables tracking, never reads/returns a secret or a customer record. */
import 'server-only';
import { capabilities } from '../gate1/storage';
import { trackingCodeEnabled, trackingCustomerEnabled, trackingTenant } from '../gate1/security';
import { evaluateGate4, validateKeysetShape } from './handoff';

export async function inspectSiteHandoff() {
  const codeEnabled=trackingCodeEnabled();
  const tenantConfigured=trackingTenant()!==null;
  const keysetConfigured=validateKeysetShape(process.env.DFL_TRACKING_S2S_KEYS_JSON);
  const capability=codeEnabled&&tenantConfigured ? await capabilities() : null;
  return evaluateGate4({codeEnabled,tenantConfigured,keysetConfigured,
    customerCertified:trackingCustomerEnabled(),capability});
}
