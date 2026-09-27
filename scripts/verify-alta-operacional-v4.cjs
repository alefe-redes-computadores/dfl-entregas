const fs=require('fs');
const store=fs.readFileSync('store/useAppStore.ts','utf8');
const route=fs.readFileSync('components/home/RouteAccordion.tsx','utf8');
const notif=fs.readFileSync('lib/native/notifications.ts','utf8');
const checks=[
 ['lote auto-organiza',store.includes('Auto-organização do lote não aplicada')],
 ['reorder usa slots livres',store.includes('const freeIndices = groups.map') && store.includes('[groups[currentIndex], groups[targetIndex]]')],
 ['drag repõe slots absolutos',store.includes('finalGroups[absoluteIndex] = freeGroups[rank]')],
 ['lock explícito bloqueia mover',store.includes("throw new Error('Destrave a parada antes de reordenar.')")],
 ['auto-organizador preserva locks',store.includes('const lockedAt = new Map') && store.includes('lockedAt.get(index) || orderedFree')],
 ['otimizador sem lock em massa',!route.includes('order_locked: optimizerEdited')],
 ['otimizador explica sem trava',route.includes('sem criar travas automáticas')],
 ['reaberta não alerta atraso',notif.includes("route.status === 'fechada' || Boolean(route.end_time)")],
 ['lembrete futuro diz 1h',notif.includes("expected.getTime() > Date.now() ? '1h'")],
 ['sem novas leituras firestore',!notif.match(/getDocs\(|onSnapshot\(/)],
];
let bad=0; for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`); if(!ok) bad++;}
if(bad) process.exit(1); console.log('\nALTA OPERACIONAL V4: contratos OK');
