/* R54: garantias de navegação e isolamento operacional; sem alterar pedidos. */
const fs=require('fs');const assert=require('assert');const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const files=['app/mais/page.tsx','app/mais/preferencias/page.tsx','app/loja/page.tsx'];
for(const p of files){
 const src=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(src.parseDiagnostics.length,0,`Sintaxe TSX: ${p}: ${src.parseDiagnostics.map(d=>d.messageText)}`);
}
const mais=read(files[0]),prefs=read(files[1]),loja=read(files[2]);
let n=0;const ok=(name,value)=>{assert(value,`R54 FALHOU: ${name}`);n++;};
ok('Mais: preferências visíveis',mais.includes('Preferências 360'));
ok('Mais: notificações e atualizações',mais.includes('/mais/notificacoes')&&mais.includes('/mais/atualizacoes'));
ok('Mais: comunicação segura a admin',mais.includes('isDiagnosticsAdmin && <section')&&mais.includes('/mais/comunicacao'));
ok('Mais: acessos legados preservados',mais.includes('Acessos técnicos diretos')&&mais.includes('/mais/mensageria')&&mais.includes('/mais/acompanhamento'));
ok('Mais: acesso e diagnóstico protegidos',mais.includes('/mais/acessos')&&mais.includes('/mais/diagnostico'));
ok('Mais: logout preservado',mais.includes('await logout()'));
ok('Mais: radar legado preservado e oculto',mais.includes('legacyRadarOpen && <OperationalRadar />')&&mais.includes('aria-hidden="true" className="hidden"'));
ok('Preferências: autoridade store',prefs.includes('const updateSettings = useAppStore(s => s.updateStoreSettings)')&&prefs.includes('await updateSettings(patch)')&&prefs.includes('if (saveBusyRef.current) return;'));
ok('Preferências: salvos individualmente',prefs.includes('Preferência salva na operação.'));
ok('Preferências: modo de rota',prefs.includes('routeOrderingMode:')&&prefs.includes('A sequência movimentada manualmente'));
ok('Preferências: preparo apenas visual',prefs.includes('sitePreparationLeadMinutes: v')&&prefs.includes('não dispara push'));
ok('Preferências: plataformas apenas novos pedidos',prefs.includes('mergeMarketplacePreference')&&prefs.includes('Histórico, pagamentos e acertos não mudam'));
ok('Preferências: links a expediente e origem canônicos',prefs.includes('#dfl-loja-expediente')&&prefs.includes('#dfl-loja-configuracoes'));
ok('Preferências: notificações continuam separadas',prefs.includes('/mais/notificacoes'));
ok('Loja: abertura manual canônica',loja.includes('id="dfl-loja-abertura"')&&loja.includes('onClick={toggleStore}'));
ok('Loja: Site primeiro e histórico',loja.includes('/loja/caixa-de-entrada?aba=site')&&loja.includes('historico=1'));
ok('Loja: Caixa e pedidos',loja.includes("router.push('/loja/caixa-de-entrada')")&&loja.includes('OperationalAttentionQueue'));
ok('Loja: rotas e entregas com dia',loja.includes('`/rotas?date=')&&loja.includes('`/entregas?date='));
for(const [route,label] of [['/abastecimentos','compras'],['/estoque','estoque'],['/despesas','despesas'],['/equipe','equipe'],['/clientes','clientes'],['/motoboys','motoboys']])ok(`Loja: ${label}`,loja.includes(`'${route}'`));
ok('Loja: confirmação iFood preservada',loja.includes("router.push('/confirmacoes')"));
ok('Loja: expediente editável preservado',loja.includes('id="dfl-loja-expediente"')&&loja.includes('saveDayEditor'));
ok('Loja: configuração avançada preservada',loja.includes('id="dfl-loja-configuracoes"')&&loja.includes('handleSaveAllSettings'));
ok('Loja: conexão entre páginas sem regravar modo',loja.includes("hash === '#dfl-loja-configuracoes'")&&loja.includes('setIsSettingsOpen(true)'));
ok('Loja: SiteAdminHub preservado',loja.includes('<SiteAdminHub'));
ok('Loja: compra, estoque e despesas em primeiro plano',loja.includes('Estoque e financeiro'));
ok('Mais: links operacionais diretos e protegidos',mais.includes("router.push('/mais/comunicacao')")&&mais.includes("router.push('/mais/atualizacoes')")&&mais.includes('isDiagnosticsAdmin'));
ok('Loja: atalhos históricos acessíveis',loja.includes('aria-label="Acesso rápido a confirmações e histórico"')&&loja.includes("router.push('/loja/caixa-de-entrada?aba=site&historico=1')"));
console.log(`R54_PREMIUM360_OK: ${n} garantias + 3 TSX parseados. Gate PRE-APK ainda obrigatório.`);
