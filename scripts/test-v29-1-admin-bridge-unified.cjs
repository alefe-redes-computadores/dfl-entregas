const fs=require("fs");
const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error("V29.1: "+m);};

const bridge=read("lib/native/admin-bridge.ts");
const hub=read("components/store/SiteAdminHub.tsx");
const page=read("app/site-admin/page.tsx");
const details=read("app/entregas/details/page.tsx");
const workflow=read(".github/workflows/main.yml");

ok(bridge.includes("br.com.dafamilialanches.admin"),"package Admin ausente");
ok(bridge.includes("https://admin.dafamilialanches.com.br"),"domínio oficial ausente");
ok(bridge.includes("Capacitor.isNativePlatform()"),"ponte não diferencia APK/web");
ok(bridge.includes("adminHomeIntentUrl")&&bridge.includes("adminOrderIntentUrl"),"ponte geral/pedido incompleta");
ok(hub.includes("openDflAdmin();")&&!hub.includes("router.push('/site-admin')"),"Minha Loja ainda usa tela intermediária");
ok(page.includes("openDflAdmin();")&&!page.includes("dafamilialanches.com.br/admin"),"tela Admin ainda força domínio antigo");
ok(details.includes("openDflAdminBridge(")&&details.includes("delivery.external_order_id"),"ficha não preserva pedido exato");
ok(workflow.includes("test-v29-1-admin-bridge-unified.cjs"),"workflow não valida V29.1");

console.log("DFL ENTREGAS V29.1 — PONTE ADMIN ÚNICA — ZERO ERROS");
