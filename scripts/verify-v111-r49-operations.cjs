#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');let n=0;
const check=(bool,name)=>{assert.ok(bool,'R49: '+name);n++};
function source(file){const body=fs.readFileSync(file,'utf8');const tree=ts.createSourceFile(file,body,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);check(tree.parseDiagnostics.length===0,'parse '+file);return body;}
const route=source('app/rotas/page.tsx');
const selection=route.slice(route.indexOf('  const rows = useMemo('),route.indexOf('  const renderedRows = useMemo('));
const render=route.slice(route.indexOf('  const renderedRows = useMemo('),route.indexOf('  const counts = useMemo('));
check(selection.includes('searchedDayRoutes.map(route =>'),'filtro textual cedo');
check(selection.includes("filter === 'todas' || state === filter"),'filtro mantém estados');
check(selection.includes('for (const delivery of linked)'),'classificação de conclusão mantém todos');
for(const heavy of ['routeOutstandingPayment(delivery)','groupDeliveriesByStop(linked).length','deliveryEconomicValue(delivery)','deliveryCustomerCharge(delivery)']){check(!selection.includes(heavy),'cálculo pesado fora do universo: '+heavy);check(render.includes(heavy),'cálculo pesado só na janela: '+heavy);}
check(render.includes('rows.slice(0, progressiveCount(rows.length, visibleLimit)).map('),'janela aplicada antes de agregar');
check(route.includes('const counts = useMemo(')&&route.includes('for (const route of dayRoutes)'),'contagens completas preservadas');
check(route.includes('role="progressbar"')&&route.includes('aria-valuenow={completed}'),'progresso acessível');
check(route.includes('{stops} parada')&&route.includes('{completed}/{linked.length} pedidos'),'paradas e pedidos separados');
const purchase=source('app/estoque/compras/page.tsx');for(const part of ['const purchaseSubmitLock = useRef(false)','if (busy || purchaseSubmitLock.current) return','if (!claimSubmission(purchaseSubmitLock)) return','setBusy(true)','await addStockSupply(supply)','releaseSubmission(purchaseSubmitLock)','selectedProducts','invalidSelected','chosen'])check(purchase.includes(part),'compra idempotência UI '+part);
check(purchase.indexOf('claimSubmission(purchaseSubmitLock)')<purchase.indexOf('await addStockSupply(supply)'),'lock precede persistência');
check(purchase.indexOf('invalidSelected.length')<purchase.indexOf('claimSubmission(purchaseSubmitLock)'),'validação antes de bloquear');
const helper=source('lib/operation/submissionGate.ts');check(helper.includes('if (lock.current) return false'),'lock síncrono');check(helper.includes('lock.current = false'),'libera em erro');
const gate=source('app/mais/acessos/liberacao/page.tsx');check(gate.includes("['R49','Cards de rotas"),'inventário até R49');check(gate.includes('assessTechnicalGate(report)'),'gate não autoaprova');
const pre=source('scripts/pre-apk.cjs');const paths=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);check(paths.length>=180,'mínimo 180 suítes R49 preservadas');check(new Set(paths).size===paths.length,'nenhuma suíte duplicada');for(const f of paths)check(fs.existsSync(f),'suíte mantida: '+f);
check(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'Rules dono preservadas');
console.log(`R49 INTEGRIDADE OPERACIONAL: ${n} contratos OK`);
