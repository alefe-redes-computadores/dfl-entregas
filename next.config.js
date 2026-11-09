/** @type {import('next').NextConfig} */
const { execFileSync } = require('node:child_process');
// Each PWA/APK build embeds its own Git revision, never a claimed APK update.
const buildRevision = () => {
  const provided = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (/^[0-9a-f]{40}$/i.test(provided)) return provided.toLowerCase();
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1800}).trim();
    if (/^[0-9a-f]{40}$/i.test(revision)) return revision.toLowerCase();
  } catch { /* Build without Git metadata remains explicitly unknown. */ }
  return 'unknown';
};
const nextConfig = {
  env: { NEXT_PUBLIC_DFL_RELEASE_SHA: buildRevision() },
  ...(process.env.DFL_STATIC_EXPORT === '1'
    ? { output: 'export' }
    : {}),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
