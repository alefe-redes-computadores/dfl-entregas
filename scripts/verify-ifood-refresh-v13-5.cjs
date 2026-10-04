const fs=require('fs');
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
const header=fs.readFileSync('components/layout/Header.tsx','utf8');
const checks=[
 ['modal compacto',card.includes('max-w-[340px]')],
 ['feedback de baixa',card.includes('Finalizando...') && card.includes('setCompletionBusy(true)') && card.includes('toast.success(')],
 ['bloqueio contra toque duplo',card.includes('completionBusyRef.current') && card.includes('disabled={groupedCodeDeliveries.some((item)')],
 ['atualização manual',header.includes('Buscar pedidos novos') && header.includes('refreshNow(true)')],
 ['retorno ao primeiro plano',header.includes("visibilitychange")],
 ['sem temporizador de consultas',!header.includes('setInterval(')],
 ['intervalo de proteção',header.includes('120_000')],
];
let failed=0;for(const [label,ok] of checks){console.log((ok?'OK: ':'ERRO: ')+label);if(!ok)failed++;}
if(failed)process.exit(1);
console.log('V13.5.1 IFOOD + ATUALIZAÇÃO: CONTRATOS OK');
