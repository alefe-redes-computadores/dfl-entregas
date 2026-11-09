import { NextRequest, NextResponse } from 'next/server';
import { validReleaseRevision } from '@/lib/operation/release-policy';

/** Public version information only. Never returns environment secrets. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
const cors = (req: NextRequest): Record<string, string> => {
  const origin = req.headers.get('origin')?.trim() || '';
  return NATIVE_ORIGINS.has(origin)
    ? { 'access-control-allow-origin': origin, 'vary': 'Origin' }
    : {};
};
export function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')?.trim() || '';
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: {
    ...cors(req), 'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'accept',
  } });
}
export function GET(req: NextRequest) {
  const revision = validReleaseRevision(process.env.VERCEL_GIT_COMMIT_SHA)
    || validReleaseRevision(process.env.GITHUB_SHA)
    || validReleaseRevision(process.env.NEXT_PUBLIC_DFL_RELEASE_SHA);
  return NextResponse.json(
    { app: 'dfl-entregas', revision, available: Boolean(revision) },
    { headers: {
      ...cors(req), 'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    } },
  );
}
