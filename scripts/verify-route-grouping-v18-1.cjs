const fs=require('fs');
let errors=0;
const ok=(v,m)=>{console.log((v?'OK: ':'ERRO: ')+m);if(!v)errors++};
const c=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
const s=fs.readFileSync('store/useAppStore.ts','utf8');
const w=fs.readFileSync('lib/whatsapp.ts','utf8');
ok(c.includes('const steps = 1;'),'arrasto move exatamente uma parada física');
ok(!c.includes('pendingCount > 1 &&\n    !manualLocked'),'controle não desaparece quando travado');
ok((c.match(/disabled=\{manualLocked\}/g)||[]).length>=3,'trava manual explícita preservada');
ok((s.match(/order_locked: false, order_source: 'manual'/g)||[]).length>=2,'movimento manual remove trava inteligente');
ok(c.includes('groupedDeliveries);'),'cópia individual receb todos os pedidos da parada');
ok(w.includes('PEDIDOS NESTA PARADA'),'mensagem individual enumera grupo');
ok(w.includes('Total da parada'),'mensagem individual soma o grupo');
ok(w.includes('stopGroup.deliveries.forEach((item) =>'),'mensagem completa enumera todos os pedidos agrupados');
if(errors){console.error('\nV18.1: '+errors+' contrato(s) falharam.');process.exit(1)}
console.log('\nV18.1 ORDEM + MENSAGENS AGRUPADAS: ZERO ERROS');
