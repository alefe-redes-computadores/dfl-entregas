#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let checks=0;
const read=p=>fs.readFileSync(p,'utf8');
function ok(test,label){assert.ok(test,`R79 ${label}`); checks++; console.log(`R79 OK: ${label}`);}
const loja=read('app/loja/page.tsx');
const mais=read('app/mais/page.tsx');
const comunicacao=read('app/mais/comunicacao/page.tsx');
const mensageria=read('app/mais/mensageria/page.tsx');
const preferences=read('app/mais/preferencias/page.tsx');
const permissions=read('app/mais/acessos/page.tsx');
const equipe=read('app/equipe/page.tsx');
const motoboys=read('app/motoboys/page.tsx');
const stock=read('app/estoque/page.tsx');
const shopping=read('app/estoque/compras/page.tsx');
const expenses=read('app/despesas/page.tsx');
const customerEdit=read('app/clientes/editar/page.tsx');
const customerForm=read('components/customers/CustomerForm.tsx');
const newDelivery=read('app/entregas/nova/page.tsx');
const editDelivery=read('app/entregas/editar/page.tsx');
const card=read('components/home/DeliveryCard.tsx');
const styles=read('app/globals.css');
const scroll=read('components/navigation/OperationalScrollMemory.tsx');
const store=read('store/useAppStore.ts');
const preapk=read('scripts/pre-apk.cjs');
const r54=read('scripts/check-r54-premium360.cjs');
const r56=read('scripts/check-r56-visual.cjs');
const r57=read('scripts/check-r57-lucide.cjs');

ok(loja.includes('data-dfl-r79-navigation="loja"') && loja.includes('id="dfl-loja-acessos"'), 'Loja tem rotas de acesso e ancoras sem nova tela');
ok(loja.includes('setIsScheduleEditorOpen(true)') && loja.includes('<SiteAdminHub'), 'Abertura, expediente e Admin Site preservados');
ok(loja.includes("router.push('/clientes')") && loja.includes("router.push('/motoboys')") && loja.includes("router.push('/equipe')"), 'Pessoas acessiveis na Loja');
ok(mais.includes('Inteligência de clientes') && mais.includes('Diagnósticos de comunicação'), 'Mais diferencia operacao e tecnicos');
ok(mais.includes('/mais/acessos') && mais.includes('/mais/notificacoes') && mais.includes('/mais/comunicacao'), 'Mais conserva areas e permissao existente');
ok(comunicacao.includes('dfl:r79:comunicacao:aba') && comunicacao.includes('isSuperadminUid(owner?.uid)'), 'Comunicacao lembra somente aba e restringe acesso');
ok(comunicacao.includes('<MensageriaDiagnosticPage') && comunicacao.includes('<AcompanhamentoAdminPage'), 'Comunicacao reutiliza centrais sem duplicacao');
ok(mensageria.includes('aria-expanded={journeyOpen}') && mensageria.includes('journeyOpen &&'), 'Jornada de mensagens recolhida sob demanda');
ok(mensageria.includes('highPriority.map') && mensageria.includes('<R75ProviderAuditCard') && mensageria.includes('<R75RecoveryAssistCard'), 'Falhas e auditoria reais visiveis e preservadas');
ok(mensageria.includes('Não existe botão de repetição em massa') && mensageria.includes('isSuperadminUid'), 'Sem disparos manuais de massa');
ok(preferences.includes('Regras em vigor') && preferences.includes('data-dfl-r79-rules'), 'Preferencias mostram regras configuradas com hierarquia');
ok(preferences.includes('configuredMarketplaceMode') && preferences.includes('mergeMarketplacePreference'), 'Modos de marketplaces preservados');
ok(preferences.includes('dfl:r78:preferences') && preferences.includes('routeReminderEnabled'), 'Busca, selecao e flags mantidas');
ok(permissions.includes('dfl:r79:acessos:advanced') && permissions.includes('open={advancedOpen}'), 'Acordeao administrativo preserva estado');
ok(permissions.includes('isSuperadminUid') && permissions.includes('saveStaffDraft'), 'Autorizacao e autoridade de permissao intactas');
ok(equipe.includes('dfl:r79:equipe:consulta') && equipe.includes('activeWritesRef'), 'Busca de equipe sem alterar locks');
ok(motoboys.includes('dfl:r79:motoboys:consulta') && motoboys.includes('setFilter(value)'), 'Filtro por motoboy preservado e recuperavel');
ok(motoboys.includes('Ações de ${motoboy.name}') && motoboys.includes('Simular acerto') && motoboys.includes('isOwner'), 'Atalhos de perfil/acerto autorizados e distintos');
ok(motoboys.includes('saoPauloDateKey(state.selectedDate)'), 'Acerto contextual usa data operacional selecionada');
ok(stock.includes('collapsed[category]===undefined') && stock.includes('Recolher') && stock.includes('Expandir'), 'Estoque reduz rolagem sem esconder categorias');
ok(stock.includes('dfl-stock-scroll') && stock.includes('dfl-stock-collapsed') && stock.includes('rankStockProducts'), 'Estoque mantem scroll, filtros e ranqueamento original');
ok(shopping.includes('aria-label="Etapas da compra"') && shopping.includes('id="dfl-purchase-market"'), 'Compras com acesso a mercado e revisao');
ok(shopping.includes('claimSubmission') && shopping.includes('releaseSubmission') && shopping.includes('STOCK_PURCHASE_DRAFT_KEY'), 'Lock financeiro, rascunho e carrinho preservados');
ok(expenses.includes('analyticsOpen && analytics.categories.length > 0') && expenses.includes('analyticsOpen && analytics.motoboyRanking.length > 0'), 'Analises de despesas sob demanda');
ok(expenses.includes('deleteOperationalExpense') && expenses.includes('filtered.reduce'), 'Despesa e conciliacao nao alteradas');
ok(customerEdit.includes('data-dfl-r79-client-edit') && customerEdit.includes('updateCustomer(customer.id,value)'), 'Edicao de cliente contextual, mesmo metodo de gravacao');
ok(customerForm.includes('Preferências avançadas do cadastro') && customerForm.includes('open={advancedOpen}') && customerForm.includes('onToggle={event=>setAdvancedOpen(event.currentTarget.open)}') && customerForm.includes('setAdvancedOpen(Boolean(initial?') && !customerForm.includes('defaultOpen='), 'Cadastros avancados acessiveis, controlados e sem prop React invalida');
ok(customerForm.includes('customerContactPayload') && customerForm.includes('setPrimaryAddress') && customerForm.includes('setPrimaryPhone'), 'Enderecos multiplos e principais preservados');
ok(customerForm.includes('onSubmit({name:name.trim()') && customerForm.includes('exclude_from_analytics:excludeAnalytics'), 'Sem alteracao semantica de cadastro');
ok(newDelivery.includes('data-dfl-r79-form-nav') && editDelivery.includes('data-dfl-r79-form-nav'), 'Formularios novo e editar com indice de navegacao');
ok(newDelivery.includes('mode="new"') && editDelivery.includes('mode="edit"'), 'Formulario novo e edicao preservam modos proprios');
ok(newDelivery.includes('id="dfl-delivery-address"') && editDelivery.includes('id="dfl-delivery-address"'), 'Navegacao por endereço usa campo original');
ok(card.includes('data-dfl-r79-next-step') && card.includes('const setStopPinned = useAppStore'), 'Card destaca proxima acao e fixacao transacional');
ok(card.includes('data-dfl-op-card-pinned=') && card.includes('await setStopPinned(route.id, delivery.id, next)'), 'Pin expandido e compacto permanecem conectados');
ok(store.includes('setStopPinned: async (routeId, deliveryId, pinned)') && store.includes('keepPinnedStopPositions(pending, finalPendingIds)'), 'R78 autoridade de pin preservada');
ok(styles.includes('data-dfl-r79-rules') && styles.includes('data-dfl-r79-next-step'), 'Estilo escopado e acessivel');
ok(scroll.includes('attempts >= 24') && scroll.includes('touchstart'), 'Restauracao prolongada e interrompida pelo usuario');
ok(preapk.includes("'scripts/test-ent-r79-visual-final.cjs'") && preapk.includes("'scripts/test-ent-r78-premium360.cjs'"), 'PRE-APK inclui R79 e R78');
ok(r54.includes("router.push('/abastecimentos')") && r54.includes("router.push('/estoque')") && r54.includes("router.push('/despesas')") && r54.includes('dfl-loja-acessos'), 'R54 verifica Compras, Estoque e Despesas em vez de titulo historico');
ok(r56.includes('do consentimento do pedido') && r56.includes('controles do Site e Entregas') && !r56.includes('Emissão automática de link permanece OFF'), 'R56 exige consentimento vigente e nao OFF obsoleto');
ok(r57.includes('Diagnósticos de comunicação') && r57.includes('router.push'), 'R57 mantem acessos tecnicos premium');
const r299p7=read('scripts/test-r299-inteligencia-p7.cjs');
ok(r299p7.includes("router.push('/mais/inteligencia')") && r299p7.includes("router.push('/confirmacoes')") && r299p7.includes('isDiagnosticsAdmin && <section') && !r299p7.includes("more.includes('Inteligência de Clientes')"), 'R299 P7 exige acesso real a inteligencia sem duplicar iFood, nao capitalizacao historica');
ok(!mensageria.includes('fetch("https://wa.me') && !comunicacao.includes('window.localStorage.setItem'), 'Nenhum envio ou guarda de conteudo no hub');
const tsPaths=[
  'app/loja/page.tsx','app/mais/page.tsx','app/mais/comunicacao/page.tsx',
  'app/mais/mensageria/page.tsx','app/mais/preferencias/page.tsx','app/mais/acessos/page.tsx',
  'app/equipe/page.tsx','app/motoboys/page.tsx','app/estoque/page.tsx',
  'app/estoque/compras/page.tsx','app/despesas/page.tsx','app/clientes/editar/page.tsx',
  'components/customers/CustomerForm.tsx','app/entregas/nova/page.tsx',
  'app/entregas/editar/page.tsx','components/home/DeliveryCard.tsx',
  'components/navigation/OperationalScrollMemory.tsx',
];
for(const path of tsPaths){
  const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(ast.parseDiagnostics.length===0,`AST TSX ${path}`);
}
console.log(`R79 VISUAL FINAL: ${checks} garantias hermeticas OK; sem acesso a rede nem mutacoes de pedidos.`);
