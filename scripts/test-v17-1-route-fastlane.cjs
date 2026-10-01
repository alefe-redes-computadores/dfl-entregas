const fs = require("fs");

const store = fs.readFileSync(
  "store/useAppStore.ts",
  "utf8",
);

const api = fs.readFileSync(
  "app/api/integration/route-kick/route.ts",
  "utf8",
);

const admin = fs.readFileSync(
  "lib/integration/server/admin.ts",
  "utf8",
);

function ok(value, message) {
  if (!value) {
    throw new Error(`V17.1: ${message}`);
  }
}

ok(
  store.includes("fetch('/api/integration/route-kick'"),
  "startRoute não acorda o fast lane",
);

ok(
  store.includes("auth.currentUser?.getIdToken()"),
  "fast lane não usa Firebase ID token",
);

ok(
  store.includes("fallback periódico preservado"),
  "fallback periódico não está protegido",
);

ok(
  api.includes("adminAuth.verifyIdToken"),
  "endpoint route-kick não valida Firebase ID token",
);

ok(
  api.includes("tracking: true"),
  "route-kick não executa tracking",
);

ok(
  api.includes("recovery: false"),
  "route-kick ativou recovery indevidamente",
);

ok(
  api.includes("analytics: false"),
  "route-kick acorda analytics indevidamente",
);

ok(
  api.includes("drainReverseIntegrationOutbox"),
  "route-kick não drena a outbox reversa",
);

ok(
  admin.includes("getAuth(adminApp)"),
  "Firebase Admin Auth não foi configurado",
);

ok(
  !api.includes("setInterval(") &&
  !api.includes("setTimeout(") &&
  !api.includes("onSnapshot("),
  "route-kick introduziu polling/listener",
);

console.log("OK: V17.1 route fast lane");
