const fs = require("fs");

const store = fs.readFileSync("store/useAppStore.ts", "utf8");
const helper = fs.readFileSync(
  "lib/integration/client/routeKick.ts",
  "utf8",
);
const route = fs.readFileSync(
  "components/home/RouteAccordion.tsx",
  "utf8",
);

const ok = (v, m) => {
  if (!v) throw new Error("V17.3 R2: " + m);
};

ok(
  store.includes("[route-kick:recovery] fast lane concluída"),
  "rota iniciada não possui recovery",
);

ok(
  store.includes("reason: 'manual_recovery'") &&
    helper.includes("routeId: safeRouteId"),
  "recovery não é dirigido pela própria rota",
);

ok(
  route.includes("handleSyncSiteRoute"),
  "ação manual ausente",
);

ok(
  route.includes("Sincronizar Site"),
  "botão de recuperação ausente",
);

ok(
  route.includes("isInProgress && hasSiteDelivery"),
  "botão não está restrito a rota em andamento com Site",
);

ok(
  !route.includes("setInterval(") &&
  !route.includes("onSnapshot("),
  "polling/listener indevido",
);

console.log("OK: V17.3 R2 recovery action");
