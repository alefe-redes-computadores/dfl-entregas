const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, label) => {
  if (!value) throw new Error(`V24.3: ${label}`);
  console.log('OK:', label);
};

const layout = read('app/layout.tsx');
const css = read('app/globals.css');
const native = read('components/NativeRuntime.tsx');

ok(
  layout.includes(
    'max(env(safe-area-inset-top, 0px), var(--dfl-native-statusbar-fallback, 0px))'
  ),
  'Toaster usa max entre inset real e fallback nativo'
);

ok(
  native.includes("Capacitor.getPlatform() === 'android'") &&
  (
    native.includes("setProperty('--dfl-native-statusbar-fallback', '44px')") ||
    native.includes("setProperty('--dfl-native-statusbar-fallback', '48px')")
  ),
  'fallback nativo entra somente no Android'
);

ok(
  native.includes('removeProperty(') &&
  native.includes('--dfl-native-statusbar-fallback'),
  'fallback é limpo no teardown'
);

ok(
  css.includes('--dfl-native-statusbar-fallback: 0px'),
  'web/PWA mantém fallback zerado'
);

ok(
  css.includes('min-height: 54px') &&
  css.includes('padding-block: 10px'),
  'toast ficou mais compacto sem reduzir a fonte'
);

ok(
  layout.includes('visibleToasts={2}') &&
  layout.includes('position="top-center"'),
  'posição e limite de pilha preservados'
);

ok(
  !layout.includes('offset="calc(env(safe-area-inset-top, 0px) + 12px)"'),
  'offset antigo vulnerável foi removido'
);

console.log('\nV24.3 TOAST ANDROID SAFE-TOP: CONTRATOS OK');
