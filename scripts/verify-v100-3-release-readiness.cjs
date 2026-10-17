// Apenas leitura. Não executa commit, push, deploy ou consulta remota.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

for (const file of [
  'lib/stock-supply-ledger.ts',
  'lib/stock-pricing.ts',
  'scripts/verify-v100-3-stock-ledger.cjs',
  'scripts/verify-v100-2-settlement-integrity.cjs',
  'scripts/verify-v89-route-messaging.cjs',
  'scripts/verify-v89-4-pickup-site-authority.cjs',
]) assert(fs.existsSync(file), `Arquivo obrigatório ausente: ${file}`);

const store = fs.readFileSync('store/useAppStore.ts', 'utf8');
assert.match(store, /Produto duplicado na contagem física/);
assert.match(store, /planStockCount\(/, 'contagem agora usa autoridade transacional');
assert.match(store, /stockExitExceeds/);
const pre = fs.readFileSync('scripts/pre-apk.cjs', 'utf8');
assert(pre.includes('scripts/verify-v100-3-stock-ledger.cjs'));
assert(pre.includes('scripts/verify-v100-3-release-readiness.cjs'));

const diff = spawnSync('git', ['diff', '--check'], { encoding: 'utf8' });
if (diff.status !== 0 && !/not a git repository/i.test(diff.stderr || '')) {
  throw new Error(`Diferenças com whitespace inválido: ${diff.stderr || diff.stdout}`);
}
const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { encoding: 'utf8' });
if (status.status === 0) {
  const filenames = status.stdout.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
  const sensitive = filenames.filter((name) => /(^|\/)(\.env(?:\.|$)|google-services\.json$|.*\.(?:jks|keystore|pem|key)$)/i.test(name));
  assert.equal(sensitive.length, 0, `Arquivos potencialmente sensíveis no Git: ${sensitive.join(', ')}`);
}
console.log('V100.3: preflight local, contagem única e contratos de release — OK');
console.log('PUBLICAÇÃO NÃO AUTORIZADA NEM EXECUTADA: após teste real, revisar diff e status antes de qualquer git add/commit/push.');
