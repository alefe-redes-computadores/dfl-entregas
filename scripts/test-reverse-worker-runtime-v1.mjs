import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin = fs.readFileSync(
  'lib/integration/server/admin.ts',
  'utf8'
);

const auth = fs.readFileSync(
  'lib/integration/server/adminAuth.ts',
  'utf8'
);

const worker = fs.readFileSync(
  'app/api/integration/worker/route.ts',
  'utf8'
);

const maintenance = fs.readFileSync(
  'app/api/integration/maintenance/route.ts',
  'utf8'
);

const outbox = fs.readFileSync(
  'lib/integration/server/reverseOutboxRepository.ts',
  'utf8'
);

const pkg = JSON.parse(
  fs.readFileSync('package.json', 'utf8')
);

assert(
  !admin.includes('firebase-admin/auth'),
  'admin.ts nao pode carregar Auth'
);

assert(
  auth.includes('firebase-admin/auth'),
  'adminAuth.ts precisa carregar Auth'
);

assert(
  maintenance.includes('adminAuth'),
  'maintenance precisa preservar autenticacao Admin'
);

assert.equal(
  pkg.overrides?.['jwks-rsa']?.jose,
  '4.15.9',
  'override jose ausente'
);

assert(
  worker.includes("stage('schedule'"),
  'schedule precisa estar protegido por stage'
);

assert(
  worker.includes('scheduleStage'),
  'worker precisa carregar scheduleStage'
);

assert(
  !outbox.includes('Math.max(limit * 3, 30)'),
  'scan minimo antigo de 30 por status retornou'
);

for (const status of ['pending', 'failed', 'processing']) {
  assert(
    outbox.includes(`.where('status', '==', '${status}')`),
    `recovery ${status} desapareceu`
  );
}

console.log('REVERSE WORKER RUNTIME V1 — CONTRATO OK');
