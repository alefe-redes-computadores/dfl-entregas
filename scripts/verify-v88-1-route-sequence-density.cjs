const fs=require('node:fs');
const source=fs.readFileSync('components/home/RouteAccordion.tsx','utf8');
const ok=(value,label)=>{if(!value)throw new Error(`V88.1: ${label}`);console.log('OK:',label)};
ok(source.includes('isOpen && !isCompleted && !isVirtualRoute && routePreviewStops.length > 0'),'sequência acompanha o card e some em rota encerrada');
ok(source.includes('setSequenceExpanded(false)'),'fechar o card também recolhe a sequência');
ok(source.includes('routePreviewStops.slice(0, sequenceShowAll ? undefined : 3)'),'prévia limita a três paradas por padrão');
ok(source.includes("Ver todas · mais ${routePreviewStops.length-3}")&&source.includes('Mostrar apenas 3 paradas'),'lista longa possui expansão reversível');
ok(source.includes('h-7 w-7')&&source.includes('text-[9px] text-zinc-500'),'linhas da sequência usam densidade compacta');
console.log('\nV88.1 SEQUÊNCIA COMPACTA: CONTRATOS OK');
