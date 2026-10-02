const fs = require("fs");

const reconciler = fs.readFileSync(
  "lib/integration/server/reverseReconciler.ts",
  "utf8",
);
const outbox = fs.readFileSync(
  "lib/integration/server/reverseOutboxRepository.ts",
  "utf8",
);
const relay = fs.readFileSync(
  "lib/integration/server/reverseRelay.ts",
  "utf8",
);
const api = fs.readFileSync(
  "app/api/integration/route-kick/route.ts",
  "utf8",
);
const store = fs.readFileSync(
  "store/useAppStore.ts",
  "utf8",
);

const ok = (value, message) => {
  if (!value) throw new Error("V17.3: " + message);
};

ok(
  reconciler.includes(
    "eventIds: candidates.map((candidate) => candidate.eventId)",
  ),
  "reconciliador não devolve eventIds",
);

ok(
  !reconciler.includes(
`str(data.source_system).trim() !== 'dfl_site' ||
        bool(data.completed)`
  ),
  "rota dirigida ainda descarta delivery concluída",
);

ok(
  outbox.includes("claimReverseOutboxByEventId"),
  "claim exato ausente",
);

ok(
  outbox.includes(
    ".doc(encodeURIComponent(input.eventId))",
  ),
  "claim exato não usa ID determinístico",
);

ok(
  relay.includes("drainReverseIntegrationEventIds"),
  "relay isolado ausente",
);

ok(
  api.includes("drainReverseIntegrationEventIds"),
  "route-kick não usa relay isolado",
);

ok(
  !api.includes(
    "const relay = await drainReverseIntegrationOutbox()",
  ),
  "route-kick ainda drena fila global",
);

ok(
  api.includes("reconciliation.eventIds"),
  "route-kick não restringe aos eventos recém-produzidos",
);

ok(
  store.includes("[route-kick:delivery]"),
  "conclusão não acorda fast lane",
);

ok(
  store.includes("routeId: nextDelivery.route_id"),
  "conclusão não envia routeId exato",
);

ok(
  api.includes("analytics: false"),
  "analytics entrou no caminho quente",
);

ok(
  !api.includes("onSnapshot(") &&
  !api.includes("setInterval("),
  "listener/polling novo introduzido",
);

console.log("OK: V17.3 isolated reverse fast lane");
