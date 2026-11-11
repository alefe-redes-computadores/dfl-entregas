/** Metadados públicos do GitHub. Jamais usar token ou URL da API para instalar APK. */
import { APK_REPOSITORY, APK_WORKFLOW, parseCertifiedAndroidRelease, classifyAndroidRun, type AndroidBuildStatus, type CertifiedApk } from './apk-release-policy';
const API = `https://api.github.com/repos/${APK_REPOSITORY}`;
const CACHE_MS = 20 * 60 * 1000;
let cache: { at: number; apk: CertifiedApk | null; status: AndroidBuildStatus } | null = null;
let inFlight: Promise<{ apk: CertifiedApk | null; status: AndroidBuildStatus }> | null = null;

async function readGithub(url: string, allow404 = false): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit', cache: 'no-store', signal: controller.signal });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`Consulta ao GitHub indisponível (HTTP ${response.status}).`);
    return response.json();
  } finally { clearTimeout(timeout); }
}

export async function checkCertifiedAndroidApk(force = false): Promise<{ apk: CertifiedApk | null; status: AndroidBuildStatus }> {
  if (inFlight) return inFlight;
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return { apk: cache.apk, status: cache.status };
  inFlight = (async () => {
    const [approved, recent, release] = await Promise.all([
      readGithub(`${API}/actions/workflows/${APK_WORKFLOW}/runs?branch=main&status=success&per_page=8`),
      readGithub(`${API}/actions/workflows/${APK_WORKFLOW}/runs?branch=main&per_page=1`),
      readGithub(`${API}/releases/latest`, true),
    ]);
    const rows = approved && typeof approved === 'object' && 'workflow_runs' in approved ? (approved as {workflow_runs?: unknown}).workflow_runs : null;
    const newest = recent && typeof recent === 'object' && 'workflow_runs' in recent ? (recent as {workflow_runs?: unknown}).workflow_runs : null;
    if (!Array.isArray(rows) || !Array.isArray(newest)) throw new Error('Histórico da Action inválido.');
    // A versão certificada é a última action APROVADA, mesmo se builds mais novos falharam.
    return { apk: parseCertifiedAndroidRelease(release, rows), status: classifyAndroidRun(newest[0]) };
  })();
  try {
    const value = await inFlight;
    cache = { at: Date.now(), ...value };
    return value;
  } finally { inFlight = null; }
}
