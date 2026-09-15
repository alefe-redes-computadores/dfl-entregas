import 'server-only';

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export function reverseRelayConfig() {
  const enabled = process.env.DFL_REVERSE_INTEGRATION_RELAY_ENABLED === 'true';
  const targetUrl = process.env.DFL_SITE_INTEGRATION_URL?.trim() || '';
  const signingSecret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim() || '';
  const triggerSecret = process.env.DFL_REVERSE_RELAY_TRIGGER_SECRET?.trim() || '';

  return {
    enabled,
    targetUrl,
    signingSecret,
    triggerSecret,
    batchSize: int(process.env.DFL_REVERSE_RELAY_BATCH_SIZE, 20, 1, 100),
    timeoutMs: int(process.env.DFL_REVERSE_RELAY_TIMEOUT_MS, 10_000, 1_000, 60_000),
    lockMs: int(process.env.DFL_REVERSE_RELAY_LOCK_MS, 60_000, 10_000, 10 * 60_000),
    maxAttempts: int(process.env.DFL_REVERSE_RELAY_MAX_ATTEMPTS, 8, 1, 50),
  };
}

export function assertReverseRelayConfigured() {
  const config = reverseRelayConfig();
  if (!config.enabled) throw new Error('Relay reverso desabilitado.');
  if (!config.targetUrl) throw new Error('DFL_SITE_INTEGRATION_URL ausente.');
  if (!config.signingSecret) throw new Error('DFL_INTEGRATION_SIGNING_SECRET ausente.');
  return config;
}
