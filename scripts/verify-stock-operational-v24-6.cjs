const fs=require('node:fs');
const r=(p)=>fs.readFileSync(p,'utf8');
const ok=(v,m)=>{if(!v)throw new Error(`V24.6: ${m}`);console.log('OK:',m)};
const move=r('app/estoque/movimentar/page.tsx');
const stock=r('app/estoque/page.tsx');
const store=r('store/useAppStore.ts');
const precision=r('lib/stock-precision.ts');
const catalog=r('lib/stock-catalog.ts');

ok(precision.includes('stockQuantityTolerance')&&precision.includes('clampStockExit'),'precisão compartilhada criada');
ok(move.includes("mode === 'remaining'")&&!move.includes("mode === 'remaining' &&\n      amount <= 0"),'quanto sobrou aceita saldo zero');
ok(move.includes("'__input-g'")&&move.includes("'__input-ml'"),'kg aceita gramas e L aceita ml');
ok(move.includes('stockExitExceeds(rawAmount, product.current_quantity, product.unit)'),'falso saldo insuficiente usa tolerância');
ok(store.includes('effectiveQuantity = isExit')&&store.includes('clampStockExit(movement.quantity, before, product.unit)'),'store usa mesma tolerância');
ok(stock.includes('const reviewOrder=useMemo(()=>groups.flatMap')&&stock.includes('JSON.stringify(reviewOrder.map(item=>item.id))'),'Salvar e próximo segue ordem visual');
ok(catalog.includes("'pct-400g','Pacote 400 g',0.4,'pct'"),'Batata palha possui pacote 400 g');
ok(store.includes('presentationMigrations')&&store.includes('canonicalByName'),'apresentações canônicas são completadas no Firebase');
console.log('\nV24.6 ESTOQUE OPERACIONAL: CONTRATOS OK');
