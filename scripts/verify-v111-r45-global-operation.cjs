#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const check=(v,m)=>{assert.ok(v,'R45 '+m);checks++;};
function source(file){const data=fs.readFileSync(file,'utf8');const out=ts.transpileModule(data,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});check(!out.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'parse '+file);return data;}
const apps=[['app/entregas/page.tsx','renderedRows','delivery.id','Pedidos'],['app/rotas/page.tsx','renderedRows','route.id','rotas'],['app/clientes/page.tsx','renderedCustomers','customer.id','clientes']];
for(const [file,window,item,label] of apps){const s=source(file);check(s.includes('progressiveCount('),'janela presente '+file);check(s.includes('nextProgressiveCount('),'lote adicional '+file);check(s.includes(window+'.map('),'render condicionado '+file);check(s.includes('setVisibleLimit(OPERATION_FIRST_BATCH)'),'reset em filtros '+file);check(s.includes('focus-visible:outline'),'acessibilidade '+file);check(s.includes('Mostrar mais '),'acao funcional '+file);check(s.includes('de {'),'contagem total '+file);check(s.includes(item),'id preservado '+file);}
const e=source('app/entregas/page.tsx');check(e.includes('const totals = useMemo(')&&e.includes('for (const delivery of dayDeliveries)'),'totais em colecao integral');check(e.includes('const rows = useMemo('),'busca integral mantida');check(e.includes('deriveDeliveryPaymentState(delivery)'),'pagamento separado de conclusao');check(e.includes('rows.length === 0'),'estado vazio usa lista filtrada completa');
const r=source('app/rotas/page.tsx');check(r.includes('for (const route of dayRoutes)'),'totais de rotas completos');check(r.includes('const deliveriesByRoute = useMemo('),'indice de pedidos preservado');check(r.includes('rows.length === 0'),'estado vazio usa lista filtrada completa');
const c=source('app/clientes/page.tsx');check(c.includes('const ranked=useMemo('),'ranking completo');check(c.includes('const filtered=useMemo('),'busca completa');check(c.includes('customerDuplicateCandidates(customers,deliveries)'),'candidatos de duplicados preservados');check(c.includes('filtered.length===0'),'estado vazio usa lista filtrada completa');
const stage=source('app/mais/acessos/homologacao/page.tsx');
for(const part of ['selectionEpoch=useRef(0)','claimsEpoch=useRef(0)','selectionEpoch.current++','claimsEpoch.current++','const epoch=selectionEpoch.current','if(epoch!==selectionEpoch.current)return;','if(epoch===claimsEpoch.current)setClaims(results)','disabled={busy} autoComplete='])check(stage.includes(part),'homologacao anti-race '+part);
check(stage.includes('requestStaffStaging(action,draftId,uid.trim()'),'fluxo homologacao preservado');check(stage.includes("toast.success('Dados preparados. Login segue BLOQUEADO.')"),'nao libera acesso');
const gate=source('app/mais/acessos/liberacao/page.tsx');check(gate.includes("['R45','Fluxos sem estado antigo"),'inventario atualizado');check(gate.includes('readyForRelease:false')||gate.includes('assessTechnicalGate('),'gate conserva avaliacao bloqueada');
const pre=source('scripts/pre-apk.cjs');const tests=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(a=>a[1]);check(tests.length>=172,'ao menos 172 suítes anteriores preservadas');check(new Set(tests).size===tests.length,'sem duplicadas');for(const test of tests)check(fs.existsSync(test),'suíte existe '+test);
check(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'rule de owner preservada');
console.log('R45 OPERATION + SECURITY:',checks,'checks OK');
