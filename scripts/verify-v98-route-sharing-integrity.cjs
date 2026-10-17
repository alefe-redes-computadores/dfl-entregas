const fs = require('fs');
const route = fs.readFileSync('components/home/RouteAccordion.tsx','utf8');
const checks = [
 ['cópia protegida contra duplo clique', route.includes('routeCopyLock.current = true') && route.includes('routeCopyLock.current = false')],
 ['estado ocupado desabilita ações de cópia',route.includes('disabled={routeCopyBusy || routeCardBusy}')],
 ['mensagem vazia não gera confirmação falsa',route.includes("if (!message?.trim()) throw new Error('Mensagem sem conteúdo')")],
 ['clipboard só confirma após writeText', /await navigator\.clipboard\.writeText\(message\);[\s\S]{0,550}toast\.success\(feedback\[0\]/.test(route)],
 ['falha de cópia apresenta erro',route.includes("toast.error('Não foi possível copiar.")],
 ['falha do feedback tátil não impede persistência', route.includes('catch { /* feedback tátil é opcional */ }') && route.includes('await safeRouteHaptic();\n      await startRoute(route.id)')],
 ['fechar rota mantém fila iFood',route.includes('ifoodPendingConfirmations') && route.includes("params.set('route', route.id)")],
 ['otimização e hotfix de paradas preservados',route.includes('const pendingStopGroups = useMemo(')],
];
let bad=0;for(const [label,ok] of checks){console.log((ok?'OK: ':'ERRO: ')+label);if(!ok)bad++;}if(bad)process.exit(1);console.log('V98 ROUTE SHARING INTEGRITY: OK');
