/** P360 P3: contrato imutável de distribuição Android, sem credenciais no app. */
export const APK_REPOSITORY = 'alefe-redes-computadores/dfl-entregas';
export const APK_WORKFLOW = 'main.yml';
export const APK_ACTIONS_URL = `https://github.com/${APK_REPOSITORY}/actions/workflows/${APK_WORKFLOW}`;
export const RELEASE_TAG_PREFIX = 'entregas-android-';
export const APK_MAX_BYTES = 150 * 1024 * 1024;

export type CertifiedApk = {
  build: number;
  runId: number;
  sha: string;
  sha256: string;
  bytes: number;
  createdAt: string;
  downloadUrl: string;
  releaseUrl: string;
};
export type AndroidBuildStatus = { kind: 'running' | 'failed' | 'success' | 'unknown'; build: number | null; url: string };

type JsonObject = Record<string, unknown>;
const object = (x: unknown): JsonObject | null => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as JsonObject : null;
const pos = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
const sha40 = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{40}$/.test(x);

export function parseInstalledApkBuild(x: unknown): number | null {
  if (typeof x !== 'string' || !/^[1-9][0-9]{0,8}$/.test(x)) return null;
  const n = Number(x);
  return pos(n) ? n : null;
}

/** Toda atualização precisa de uma Action COMPLETA e APROVADA do main. */
export function parseApprovedAndroidRun(raw: unknown): { build: number; runId: number; sha: string } | null {
  const r = object(raw);
  if (!r || !pos(r.id) || !pos(r.run_number) || !sha40(r.head_sha)) return null;
  if (r.head_branch !== 'main' || r.status !== 'completed' || r.conclusion !== 'success') return null;
  if (r.event !== 'push' && r.event !== 'workflow_dispatch') return null;
  if (typeof r.path !== 'string' || !(r.path === '.github/workflows/main.yml' || r.path.startsWith('.github/workflows/main.yml@'))) return null;
  return { build: r.run_number, runId: r.id, sha: r.head_sha };
}

/** Sem digest fornecido pelo GitHub, sem release correlata, sem download integrado. */
export function parseCertifiedAndroidRelease(raw: unknown, approvedRuns: readonly unknown[]): CertifiedApk | null {
  const rel = object(raw);
  if (!rel || rel.draft !== false || rel.prerelease !== false || typeof rel.published_at !== 'string' || !Number.isFinite(Date.parse(rel.published_at))) return null;
  if (typeof rel.tag_name !== 'string') return null;
  const match = /^entregas-android-([1-9][0-9]{0,8})$/.exec(rel.tag_name);
  if (!match) return null;
  const build = Number(match[1]);
  const approved = approvedRuns.map(parseApprovedAndroidRun).find(x => x && x.build === build) || null;
  if (!approved || !sha40(rel.target_commitish) || rel.target_commitish !== approved.sha) return null;
  const name = `DFL-Entregas-${build}.apk`;
  const downloadUrl = `https://github.com/${APK_REPOSITORY}/releases/download/${RELEASE_TAG_PREFIX}${build}/${name}`;
  const asset = Array.isArray(rel.assets) ? rel.assets.map(object).find(a => a && a.name === name && a.state === 'uploaded') : null;
  if (!asset || !pos(asset.id) || !pos(asset.size) || asset.size < 100_000 || asset.size > APK_MAX_BYTES) return null;
  if (asset.browser_download_url !== downloadUrl || typeof asset.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(asset.digest)) return null;
  return {
    build,
    runId: approved.runId,
    sha: approved.sha,
    sha256: asset.digest.slice(7).toLowerCase(),
    bytes: asset.size,
    createdAt: rel.published_at,
    downloadUrl,
    releaseUrl: `https://github.com/${APK_REPOSITORY}/releases/tag/${RELEASE_TAG_PREFIX}${build}`,
  };
}

export function isNewCertifiedApk(installed: number | null, update: CertifiedApk | null): boolean {
  return installed !== null && update !== null && update.build > installed;
}

export function classifyAndroidRun(raw: unknown): AndroidBuildStatus {
  const r = object(raw);
  const build = pos(r?.run_number) ? r!.run_number as number : null;
  const url = typeof r?.html_url === 'string' && /^https:\/\/github\.com\/alefe-redes-computadores\/dfl-entregas\/actions\/runs\/[0-9]+$/.test(r.html_url) ? r.html_url : APK_ACTIONS_URL;
  if (!r || r.head_branch !== 'main' || !build) return { kind: 'unknown', build: null, url: APK_ACTIONS_URL };
  if (r.status !== 'completed') return { kind: 'running', build, url };
  return { kind: r.conclusion === 'success' ? 'success' : 'failed', build, url };
}
