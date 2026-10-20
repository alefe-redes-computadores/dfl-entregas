'use strict';
/** R23: testes comportamentais de whitelists e fronteira de autorizacao. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const Module=require('node:module');
const read=(p)=>fs.readFileSync(p,'utf8');
const source=read('lib/access/staffProjection.ts');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const mod=new Module('r23-projection-behavioral');
mod.filename='r23-projection-behavioral.js';
mod.paths=module.paths;
mod._compile(code,mod.filename);
const functions=mod.exports;
const pii={
  phone:'TELEFONE_SENTINELA_9999', address:'ENDERECO_SENTINELA',
  email:'EMAIL_SENTINELA', total_amount:'PRECO_SENTINELA',
  customer_name:'CLIENTE_SENTINELA', observation:'OBS_SENTINELA',
  payment_method:'PAGAMENTO_SENTINELA', secret:'TOKEN_SENTINELA',
  name:'Sabonete', status:'aberta',current_quantity:10,unit:'un',items:[{},{}],
};
for(const [fn,name] of [[functions.projectRoute,'Rota'],[functions.projectDelivery,'Entrega'],[functions.projectProduct,'Estoque'],[functions.projectPurchase,'Compra']]){
 const row=fn(pii,'id-123');
 assert.deepEqual(Object.keys(row).sort(),['status','subtitle','title']);
 assert(row.title && row.subtitle && row.status);
 const json=JSON.stringify(row);
 for(const marker of ['SENTINELA'])assert(!json.includes(marker),`${name} vazou campo: ${marker}`);
 console.log('R23 OK: whitelist executável',name);
}
assert.deepEqual(functions.stageReadPermissions(['home','routes_read','routes_read','finance','staff_admin','diagnostics','purchases_write','stock_read']),['home','routes_read','stock_read']);
assert(functions.projectHome({routes:1,deliveries:2,stock:3,purchases:4}).subtitle.includes('2 entregas'));
const endpoint=read('app/api/access/staging/route.ts');
assert(endpoint.includes('function cors(req: NextRequest): Record<string, string> {'), 'R23.1: cabecalhos CORS devem possuir tipo de indice string para evitar TS2322');
const client=read('lib/access/staffStagingClient.ts');
const screen=read('app/mais/acessos/homologacao/page.tsx');
const sourceRules=read('security/firestore.v111-r23-owner-only.rules');
const ownerUid=read('lib/access/roles.ts');
const main=read('app/mais/acessos/page.tsx');
const previous=read('security/firestore.v111-r22-staff-staged.rules');
const pre=read('scripts/pre-apk.cjs');
for (const [content,fragments,label] of [
 [endpoint,['verifyIdToken(header.slice(7), true)','isSuperadminUid(token.uid)','adminAuth.getUser(targetUid)','user.emailVerified','lower(user.email) !== lower(draft.email)','draft.status !== \'rascunho\'','status:\'suspended\'','stageReadPermissions(draft.permissions)','batch.commit()','CONFIRM'], 'API protegida por UID e identidade verificada'],
 [client,['actor!.getIdToken()','NEXT_PUBLIC_DFL_SERVER_ORIGIN','Capacitor.isNativePlatform()','cache: \'no-store\'','response.ok'], 'Cliente seguro PWA e APK'],
 [screen,["execute('verify')","execute('preview')","execute('stage')",'setConfirm(e.target.checked)','Login continua bloqueado'], 'Tela com três etapas e confirmação'],
 [main,["router.push('/mais/acessos/homologacao')"], 'Rota de homologação no painel'],
 [pre,['verify-v111-r23-verified-staging.cjs','verify-v111-r22-staff-isolation.cjs'], 'PRE-APK progressivo'],
 [previous,['match /staff_accounts/{uid}','activeStaff(uid)'], 'R22 candidata intacta'],
 ]){
  for(const piece of fragments)assert(content.includes(piece),`Contrato ${label} falhou: ${piece}`);
  console.log('R23 OK:',label);
}
assert(ownerUid.includes('zIfbMxD1SQNvtlX9y6YUsEz2TXC3'));
assert(sourceRules.includes('zIfbMxD1SQNvtlX9y6YUsEz2TXC3'));
assert(!/allow\s+(?:read|write)[^;]*if\s+true/.test(sourceRules));
assert(!endpoint.includes("status:'active'"));
assert(!endpoint.includes("'staff_accounts').doc(user.uid).set"));
assert(!endpoint.includes('...doc.data()'));
assert(!endpoint.includes('request.auth != null'));
console.log('DFL V111 R23: todos contratos e testes comportamentais aprovados.');
