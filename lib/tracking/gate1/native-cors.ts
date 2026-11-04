/** R250: only Capacitor/localhost origins may read owner-only tracking diagnostics.
 * These headers never grant authority; Firebase owner tokens are always required.
 */
const nativeOrigins = new Set(['https://localhost','http://localhost','capacitor://localhost']);
export function ownerNativeCors(origin: string | null, method: 'GET' | 'POST') {
  if (!origin || !nativeOrigins.has(origin)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': `${method}, OPTIONS`,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '300',
    vary: 'Origin',
  };
}
