const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, label) => { if (!value) throw new Error(`V24.1: ${label}`); console.log('OK:', label); };

const layout = read('app/layout.tsx');
const css = read('app/globals.css');
const store = read('store/useAppStore.ts');
const header = read('components/layout/Header.tsx');
const diagnostics = read('app/mais/diagnostico/page.tsx');
const toast = read('lib/operational-toast.ts');
const health = read('lib/site-integration-health.ts');

ok(layout.includes('env(safe-area-inset-top') && css.includes('[data-sonner-toaster]'), 'toast respeita barra do Android');
ok(layout.includes('CheckCircle2') && layout.includes('AlertTriangle') && layout.includes('LoaderCircle'), 'toast usa iconografia Lucide');
ok(layout.includes('visibleToasts={2}') && css.includes('.dfl-toast-close'), 'pilha e fechamento compactos');
ok(toast.includes('Haptics.notification') && toast.includes('Capacitor.isNativePlatform'), 'feedback tatil somente no APK');
ok(toast.includes('stableId') && toast.includes('data?.id ??'), 'mensagens repetidas sao deduplicadas');
ok(store.includes('initDataInFlight') && header.includes('refreshInFlightRef'), 'sincronizacao possui trava central e visual');
ok(diagnostics.includes('syncClickLockRef'), 'diagnostico bloqueia toque duplo sincronamente');
ok(!store.includes('siteCompletionDivergences') && !diagnostics.includes('siteCompletionDivergences'), 'falso alerta local removido');
ok(!health.includes('siteCompletionDivergences') && diagnostics.includes('recovery.stats'), 'fila remota e unica fonte de pendencia');
ok(health.includes('Conclusao registrada para o Site'), 'ficha usa estado verificavel e nao promete confirmacao remota');

console.log('\nV24.1 TOAST + SYNC HOTFIX: CONTRATOS OK');
