const fs = require("fs");

const reconciler = fs.readFileSync(
  "lib/integration/server/reverseReconciler.ts",
  "utf8",
);
const worker = fs.readFileSync(
  "app/api/integration/worker/route.ts",
  "utf8",
);

const ok = (v, m) => {
  if (!v) throw new Error("V17.4 ENTREGAS: " + m);
};

ok(
  reconciler.includes("statusRecoveryReplay?: boolean"),
  "contrato possui replay de recuperação",
);

ok(
  reconciler.includes("48 * 60 * 60 * 1000"),
  "replay limitado às últimas 48h",
);

ok(
  reconciler.includes(".limit(40)"),
  "replay continua limitado",
);

ok(
  reconciler.includes("recovery-v17-4-"),
  "evento de recuperação recebe identidade nova",
);

ok(
  reconciler.includes("recoveryReplay: true"),
  "payload identifica recuperação",
);

ok(
  worker.includes("status_recovery_v17_4_done"),
  "checkpoint impede repetição permanente",
);

ok(
  worker.includes("drainReverseIntegrationEventIds"),
  "replay usa relay exato",
);

ok(
  !worker.includes("setInterval(") &&
  !worker.includes("onSnapshot("),
  "nenhum polling/listener novo",
);

console.log("OK: V17.4 Entregas status recovery");
