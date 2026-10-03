const fs = require("fs");
const { spawnSync } = require("child_process");

const suites = [
  "scripts/test-v25-admin-entregas-bridge.cjs",
];

for (const suite of suites) {
  if (!fs.existsSync(suite)) {
    throw new Error(`V26 ENTREGAS: suíte ausente: ${suite}`);
  }

  const result = spawnSync(process.execPath, [suite], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`V26 ENTREGAS: falhou ${suite}`);
  }
}

const bridge = fs.readFileSync("lib/native/admin-bridge.ts", "utf8");
const runtime = fs.readFileSync("components/NativeRuntime.tsx", "utf8");
const resolver = fs.readFileSync("app/entregas/abrir/page.tsx", "utf8");
const workflow = fs.readFileSync(".github/workflows/main.yml", "utf8");

if (!bridge.includes("/entregas/abrir?id=")) {
  throw new Error("V26 ENTREGAS: deep-link não usa resolver resiliente.");
}
if (!runtime.includes("App.getLaunchUrl()")) {
  throw new Error("V26 ENTREGAS: cold start ausente.");
}
if (!runtime.includes("appUrlOpen")) {
  throw new Error("V26 ENTREGAS: app já aberto não recebe URL.");
}
if (!resolver.includes("hasHydrated")) {
  throw new Error("V26 ENTREGAS: resolver não aguarda hidratação.");
}
if (!resolver.includes("initData")) {
  throw new Error("V26 ENTREGAS: resolver não possui recuperação de sincronização.");
}
if (!workflow.includes("patch-android-admin-bridge.mjs")) {
  throw new Error("V26 ENTREGAS: workflow perdeu patch Android da ponte.");
}

console.log("V26 ENTREGAS RELEASE GATE — ZERO ERROS");
