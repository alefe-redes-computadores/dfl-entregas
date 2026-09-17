import fs from 'node:fs';

const activityPath =
  'android/app/src/main/java/com/dfl/entregas/MainActivity.java';

if (!fs.existsSync(activityPath)) {
  throw new Error(
    `MainActivity gerada não encontrada em ${activityPath}. ` +
    'O patch deve rodar somente depois de npx cap add/sync android.'
  );
}

let source = fs.readFileSync(activityPath, 'utf8');

if (
  source.includes('WindowCompat.setDecorFitsSystemWindows') ||
  source.includes('setAppearanceLightStatusBars')
) {
  throw new Error(
    'MainActivity já contém configuração de System Bars. ' +
    'Abortando para não criar dois contratos nativos.'
  );
}

if (!source.includes('import android.os.Bundle;')) {
  source = source.replace(
    'package com.dfl.entregas;',
    `package com.dfl.entregas;

import android.os.Bundle;
import android.graphics.Color;

import androidx.core.view.WindowCompat;`
  );
} else {
  source = source.replace(
    'import android.os.Bundle;',
    `import android.os.Bundle;
import android.graphics.Color;

import androidx.core.view.WindowCompat;`
  );
}

const emptyActivity =
  'public class MainActivity extends BridgeActivity {}';

const expandedActivity = `public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(
            getWindow(),
            false
        );

        getWindow().setStatusBarColor(
            Color.TRANSPARENT
        );

        getWindow().setNavigationBarColor(
            Color.TRANSPARENT
        );

        WindowCompat
            .getInsetsController(
                getWindow(),
                getWindow().getDecorView()
            )
            .setAppearanceLightStatusBars(false);
    }
}`;

if (!source.includes(emptyActivity)) {
  throw new Error(
    'Formato gerado de MainActivity divergiu do contrato esperado do Capacitor. ' +
    'Nenhuma substituição foi feita.'
  );
}

source = source.replace(emptyActivity, expandedActivity);

fs.writeFileSync(activityPath, source);

const result = fs.readFileSync(activityPath, 'utf8');

const required = [
  'WindowCompat.setDecorFitsSystemWindows',
  'setStatusBarColor',
  'Color.TRANSPARENT',
  'setNavigationBarColor',
  'setAppearanceLightStatusBars(false)',
];

for (const contract of required) {
  if (!result.includes(contract)) {
    throw new Error(`Contrato nativo ausente após patch: ${contract}`);
  }
}

console.log('Android System Bars patch aplicado com sucesso.');
console.log(`Arquivo: ${activityPath}`);
