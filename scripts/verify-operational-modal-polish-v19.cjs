const fs = require('fs');
let errors = 0;
const ok = (value, label) => {
  console.log(`${value ? 'OK' : 'ERRO'}: ${label}`);
  if (!value) errors += 1;
};
const store = fs.readFileSync('store/useAppStore.ts', 'utf8');
const checklist = fs.readFileSync('components/routes/RouteDepartureChecklist.tsx', 'utf8');
const route = fs.readFileSync('components/home/RouteAccordion.tsx', 'utf8');
ok(store.includes('void kickSiteRoute(routeId'), 'integração do Site não bloqueia o fechamento do modal');
ok(store.includes('.catch((kickError)'), 'falha assíncrona continua tratada');
ok(store.includes('Reprocessar integração nas ferramentas da rota'), 'recuperação aponta para o local correto');
ok(checklist.includes('useMemo('), 'cálculos do checklist memoizados');
ok(checklist.includes('aria-busy={busy}'), 'estado ocupado acessível');
ok(checklist.includes('LoaderCircle') && checklist.includes('animate-spin'), 'feedback visual imediato');
ok(checklist.includes('busySeconds >= 4'), 'espera longa recebe explicação');
ok(checklist.includes("document.body.style.overflow = 'hidden'"), 'fundo protegido durante o modal');
ok(route.includes('await Haptics.impact({ style: ImpactStyle.Medium });\n      }\n      await startRoute(route.id);'), 'confirmação da saída tem feedback tátil imediato');
if (errors) {
  console.error(`\nV19: ${errors} contrato(s) falharam.`);
  process.exit(1);
}
console.log('\nV19 MODAIS OPERACIONAIS: ZERO ERROS');
