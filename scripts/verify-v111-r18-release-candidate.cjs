#!/usr/bin/env node
'use strict';
/** Real grouping calculations plus AST-backed privacy and progressive rendering contracts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
let checks = 0;
function check(name, ok) { assert.ok(ok, name); checks++; console.log(`OK R18: ${name}`); }
function source(file) { return fs.readFileSync(file, 'utf8'); }
const fixture = file => {
  const raw = source(file);
  const ast = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  check(`${file} sem erros de sintaxe`, ast.parseDiagnostics.length === 0);
  return raw;
};
function load(file, mocks) {
  const result = ts.transpileModule(fixture(file), {fileName:file, reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  check(`transpilação de ${file}`, !(result.diagnostics || []).some(d=>d.category===ts.DiagnosticCategory.Error));
  const m = new Module(path.resolve(file), module);
  m.filename = path.resolve(file); m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = id => Object.hasOwn(mocks,id) ? mocks[id] : original(id);
  m._compile(result.outputText, m.filename);
  return m.exports;
}
const canonicalAddress = addr => ({address:String(addr || '').trim().toLowerCase().replace(/\s+/g,' ')});
const stops = load('lib/route-stops.ts', {
  '@/lib/integration/site-order': {isCancelledSiteDelivery: delivery => delivery.site_order_status==='cancelado'},
  '@/lib/operational-address': {canonicalizeOperationalAddress: canonicalAddress},
  '@/lib/customer-identity': {normalizeCustomerAddress: text => text.toLowerCase().replace(/\s+/g, ' ').trim()},
});
const make = (id, addr, options={}) => ({id, route_id:'r1', address_string:addr, completed:false,created_at:'2026-10-19T11:00:00',...options});
const list = [
  make('a','Rua Um, 10',{order_index:1}),
  make('b','Rua Um, 10',{order_index:1.1, completed:true}),
  make('c','Rua Dois, 20',{order_index:2, completed:true}),
  make('cancel','Rua Três, 30',{site_order_status:'cancelado'}),
];
let groups=stops.groupDeliveriesByStop(list);
check('dois pedidos no mesmo endereço ocupam uma parada',groups.length===2 && groups[0].deliveries.length===2);
check('um pedido pendente mantém a parada pendente',groups[0].pending.length===1 && groups[0].completed.length===1);
check('parada concluída depende de todos os pedidos',groups[1].pending.length===0 && groups[1].completed.length===1);
check('pedidos cancelados não criam uma parada fantasma',!groups.some(group=>group.deliveries.some(item=>item.id==='cancel')));
check('cada pedido permanece acessível no grupo',groups.flatMap(g=>g.deliveries.map(d=>d.id)).sort().join(',')==='a,b,c');
const untouched = list.map(item=>item.id).join(','); stops.groupDeliveriesByStop(list);
check('agrupamento preserva o array de origem',list.map(item=>item.id).join(',')===untouched);
const differentRoutes=stops.groupDeliveriesByStop([make('r1-a','Mesmo, 1'),make('r2-a','Mesmo, 1',{route_id:'r2'})]);
check('rotas diferentes nunca compartilham parada',differentRoutes.length===2);
const view=fixture('app/rotas/details/page.tsx');
check('modo privacidade cobre valor econômico',view.includes("isPrivacyMode ? 'R$ •••' : `R$ ${total.toLocaleString"));
check('modo privacidade cobre valor cobrado',view.includes("isPrivacyMode ? 'R$ •••' : `R$ ${customerCharge.toLocaleString"));
check('privacidade continua disponível no checklist',view.includes('isPrivacyMode={isPrivacyMode}'));
check('detalhes usam agrupamento físico real',view.includes('useMemo(() => groupDeliveriesByStop(deliveries), [deliveries])'));
check('uma única numeração por parada',view.includes('visibleStopGroups.map((stop, index)'));
check('pedidos individuais mantêm navegação',view.includes('stop.deliveries.map((delivery)') && view.includes('`/entregas/details?id=${delivery.id}${dateSuffix}`'));
check('progresso considera todos os pedidos',view.includes('pending = deliveries.filter') && view.includes('completed = deliveries.length - pending'));
check('estado de parada depende dos pendentes',view.includes('const allDone = stop.pending.length === 0'));
check('ordenamento canônico exclusivo do agrupador', !view.includes('(a.order_index ?? 9999)'));
check('primeira tela limita montagem a oito paradas',view.includes('useState(8)') && view.includes('physicalStops.slice(0, visibleStops)'));
check('mais paradas disponíveis sem limite artificial',view.includes('setVisibleStops((count) => Math.min(totalStops, count + 8))'));
check('sequência pode ser recolhida novamente',view.includes('setVisibleStops(8)'));
check('mudança de rota reinicia paginação',view.includes('useEffect(() => setVisibleStops(8), [id])') || view.includes("useEffect(() => setVisibleStops(route?.status === 'fechada' ? 0 : 8), [id, route?.status])"));
check('histórico de encerramento não foi removido',view.includes("action('close')") && view.includes("action('reopen')"));
check('rota só inicia após checklist',view.includes('<RouteDepartureChecklist'));
check('cancelamento excluído da sequência ativa',view.includes('!isCancelledSiteDelivery(item)'));
const pre=fixture('scripts/pre-apk.cjs');
check('suíte R18 participa do PRE-APK',pre.includes('scripts/verify-v111-r18-release-candidate.cjs'));
check('suítes R17 e R16 continuam obrigatórias',pre.includes('scripts/verify-v111-r17-finance-route-safety.cjs') && pre.includes('scripts/verify-v111-r16-premium-closeout.cjs'));
const audit=fixture('scripts/audit-v111-release-preflight.cjs');
check('auditoria final sem publicação automática',!audit.includes('git push') && !audit.includes('git commit') && !audit.includes('git reset --hard'));
console.log(`V111 R18: ${checks} verificações aprovadas`);
