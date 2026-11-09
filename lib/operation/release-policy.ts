/** R300 P3 — distinguish a proven deployed revision from an unknown build.
 * A newer web deployment does not prove a newer Android APK exists.
 */
export type ReleaseComparison = 'same' | 'different' | 'unknown';
const REVISION = /^[0-9a-f]{40}$/;
export function validReleaseRevision(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return REVISION.test(candidate) ? candidate : null;
}
export function compareReleaseRevisions(local: unknown, remote: unknown): ReleaseComparison {
  const left = validReleaseRevision(local);
  const right = validReleaseRevision(remote);
  if (!left || !right) return 'unknown';
  return left === right ? 'same' : 'different';
}
export function shortReleaseRevision(value: unknown): string {
  return validReleaseRevision(value)?.slice(0, 8) || 'Não identificada';
}
