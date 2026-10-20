#!/usr/bin/env node
// R13: execução real da regra de pendências; os demais contratos verificam
// a integração TSX e garantem que as proteções herdadas não sejam removidas.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let checks = 0;
const check = (name, condition) => {
  if (!condition) { console.error(`FALHOU R13: ${name}`); process.exitCode = 1; }
  else { checks++; console.log(`OK R13: ${name}`); }
};
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const readTs = file => {
  const code = read(file);
  const syntax = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  check(`sintaxe TS/TSX: ${file}`, syntax.parseDiagnostics.length === 0);
  return code;
};
const helperSource = readTs('lib/operational-home-actions.ts');
const compiled = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const virtual = new Module('r13-home-actions', module);
virtual.filename = path.join(process.cwd(), 'lib/operational-home-actions.ts');
virtual.paths = module.paths;
virtual._compile(compiled, virtual.filename);
const { routeIfoodCodeProgress } = virtual.exports;
const openRoutes = new Set(['a']);
const base = {origin:'ifood', route_id:'a'};
const empty = routeIfoodCodeProgress([], openRoutes);
check('fila vazia não alerta', empty.active===0 && empty.collected===0 && empty.missing===0);
const missing = routeIfoodCodeProgress([{...base,confirmation_code:''}], openRoutes);
check('um código ausente gera uma pendência',missing.active===1 && missing.missing===1);
const done = routeIfoodCodeProgress([{...base,confirmation_code:'1234'}], openRoutes);
check('um código válido não gera pendência',done.active===1 && done.collected===1 && done.missing===0);
const allDone = routeIfoodCodeProgress([{...base,confirmation_code:'1234'},{...base,confirmation_code:'4321'}], openRoutes);
check('todos os códigos coletados não geram pendência',allDone.active===2 && allDone.missing===0);
const mixed = routeIfoodCodeProgress([{...base,confirmation_code:'12-34'},{...base,confirmation_code:'23'}, {...base,confirmation_code:''}],openRoutes);
check('fração e formatação de códigos',mixed.active===3 && mixed.collected===1 && mixed.missing===2);
const unrelated = routeIfoodCodeProgress([{...base,route_id:'b',confirmation_code:''},{...base,origin:'site',confirmation_code:''},{...base,route_id:null,confirmation_code:''}],openRoutes);
check('códigos de outras rotas e origens ficam fora',unrelated.active===0 && unrelated.missing===0);
const code = routeIfoodCodeProgress([{...base,confirmation_code:'abc'}, {...base,confirmation_code:'1 2 3 4 5'}],openRoutes);
check('códigos não válidos continuam pendentes', code.active===2 && code.collected===0 && code.missing===2);
const component = readTs('components/home/OperationalCommandCenter.tsx');
const closed = readTs('components/home/ClosedRoutesSection.tsx');
const page = readTs('app/page.tsx');
const route = readTs('components/home/RouteAccordion.tsx');
const pre = read('scripts/pre-apk.cjs');
check('status iFood usa cálculo centralizado', /routeIfoodCodeProgress\(deliveries, openRouteIds\)/.test(component));
check('a fila só recebe os códigos faltantes', /count: routeCodes\.missing/.test(component));
check('código coletado não substitui confirmação externa', component.includes('externalPending.length') && component.includes('confirmationHref'));
check('backlog global memorizado', /const pendingSiteOrders = useMemo\(/.test(component));
check('operações críticas ordenadas antes da limitação', /\.sort\(\(a, b\) => b\.priority - a\.priority\)/.test(component));
check('no máximo duas ações inicialmente', /visibleActionRows\.slice\(0, 2\)/.test(component));
check('fila integral acessível sob expansão', /showAllActions \? visibleActionRows/.test(component));
check('botão acessível para expansão', /aria-expanded=\{showAllActions\}/.test(component) && /setShowAllActions/.test(component));
check('filtros de caixa seguem outros módulos', !/payment_state/.test(component));
check('histórico reverso sem alterar array da loja', /\[\.\.\.routes\]\.sort/.test(closed));
check('histórico por padrão limita montagem a duas rotas', /useState\(2\)/.test(closed) && /recentFirst\.slice\(0, visibleLimit\)/.test(closed));
check('histórico integral acessível progressivamente', /setVisibleLimit\(limit => limit \+ 10\)/.test(closed));
check('histórico com controle de recolher', /aria-expanded=\{expanded\}/.test(closed) && /setVisibleLimit\(2\)/.test(closed));
check('histórico preserva agrupamento por motoboy', /Map<string, Route\[\]>/.test(closed));
check('histórico no painel principal', /<ClosedRoutesSection/.test(page));
check('histórico reinicia ao mudar data ou filtro', /key=\{`\$\{selectedDateKey\}:\$\{globalMotoboy/.test(page));
check('filtro inválido de motoboy é limpo na mudança de dia', /!activeMotoboysToday\.some/.test(page) && /setGlobalMotoboy\(null\)/.test(page));
check('rotas abertas seguem visíveis', /openRoutes\.map\(\(route, index\)/.test(page));
check('resumo financeiro segue respeitando privacidade', /isPrivacyMode\s*\? 'R\$ •••'/.test(page));
check('rotas fechadas são recolhidas após transição', /previousRouteStatus\.current !== 'fechada'/.test(route) && /setIsOpen\(false\)/.test(route));
check('sequência e ferramentas recolhidas na conclusão', /setSequenceShowAll\(false\)/.test(route) && /setShowRouteTools\(false\)/.test(route));
check('painel fechado preserva opção de expansão manual', /onClick=\{toggleRouteOpen\}/.test(route));
check('revisões de dados não disparam resets de expansão', /\[defaultOpen, isVirtualRoute, route\.id\]/.test(route));
check('fechamento continua transacional no store', /closeRoute = useAppStore/.test(route) && /closingRouteIds\.includes/.test(route));
check('suíte R13 vinculada ao PRE-APK', pre.includes('scripts/verify-v111-r13-home-premium.cjs'));
console.log(`R13: ${checks} contratos aprovados`);
if (process.exitCode) process.exit(process.exitCode);
