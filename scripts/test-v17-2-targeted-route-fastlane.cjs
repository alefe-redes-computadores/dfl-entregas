const fs = require("fs");

const reconciler = fs.readFileSync(
  "lib/integration/server/reverseReconciler.ts",
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
  if (!value) throw new Error("V17.2: " + message);
};

ok(
  reconciler.includes("routeId?: string;"),
  "routeId não entrou no contrato",
);

ok(
  reconciler.includes("targetedRouteId"),
  "reconciliação dirigida ausente",
);

ok(
  reconciler.includes(".where('route_id', '==', targetedRouteId)"),
  "fast lane ainda não consulta a rota exata",
);

ok(
  reconciler.includes("str(data.source_system).trim() !== 'dfl_site'"),
  "rota dirigida não filtra pedidos do Site",
);

ok(
  api.includes("routeId obrigatório"),
  "endpoint aceita kick sem rota",
);

ok(
  api.includes("routeId,"),
  "endpoint não passa routeId ao reconciliador",
);

ok(
  store.includes("body: JSON.stringify({ routeId })"),
  "startRoute não envia routeId",
);

ok(
  api.includes("analytics: false"),
  "fast lane acordou analytics",
);

ok(
  !api.includes("setInterval(") &&
  !api.includes("onSnapshot("),
  "polling/listener introduzido",
);

console.log("OK: V17.2 targeted route fast lane");
