// V105: gesture safety, recurrence calculation, grouped stock alert + no new queries.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const read = (file) => fs.readFileSync(file, 'utf8');
const card = read('components/home/DeliveryCard.tsx');
const notifier = read('lib/native/notifications.ts');
const recurrence = read('lib/customer-recurrence.ts');
const store = read('store/useAppStore.ts');
const pipeline = read('components/home/RouteAccordion.tsx');

// Gestos: somente pela alça, Pointer Capture e posicionamento por PARADA física.
assert.match(card, /<GripVertical size=\{16\}/);
assert.match(card, /touchAction: 'none'/);
assert.match(card, /setPointerCapture\(event.pointerId\)/);
assert.match(card, /handleReorderPointerCancel|onPointerCancel=\{clearReorderGesture\}/);
assert.match(card, /data-dfl-stop-index=\{canReorder \? position : undefined\}/);
assert.match(card, /element\.dataset\.dflRouteId === route\.id/);
assert.match(card, /void moveStop\(target\)/);
assert.match(card, /Math\.abs\(event\.clientY - gesture\.startY\) < 8/);
assert.match(card, /onLostPointerCapture=\{clearReorderGesture\}/);
assert.match(store, /const groups = groupDeliveriesByStop\(pending\)/);
assert.match(store, /const orderedIds = moveStopToIndex\(pending, deliveryId, rawTarget\)/);
assert.match(pipeline, /pendingStopGroups/);

// Estoque: zero mesmo com mínimo zero, notificações de fundo agrupadas por produto.
assert.match(notifier, /\.filter\(\(\{ after \}\) => after\.active !== false\)/);
assert.match(notifier, /after\.minimum_quantity > 0 &&\s*before\.current_quantity/);
assert.match(notifier, /stock-product:\$\{item\.product\.id\}:\$\{item\.level\}/);
assert.match(notifier, /if \(sent\) \{\s*for \(const item of alertable\) rememberSent/);
assert.match(notifier, /document\.visibilityState === 'visible'/);
assert.match(notifier, /CapacitorApp\.getState\(\)\)\.isActive/);

// Compara cálculo de recorrência indexado contra implementação ingênua.
const js = ts.transpileModule(recurrence, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = new Module(path.join(process.cwd(), 'lib/customer-recurrence.ts'), module);
mod.filename = path.join(process.cwd(), 'lib/customer-recurrence.ts');
mod.paths = module.paths;
mod._compile(js, mod.filename);
const compute = mod.exports.customerRecurrence;
const orders = [];
for (let i = 0; i < 11; i++) orders.push({ id:`a${i}`, customer_id:'a', completed:true, origin:i%2?'site':'ifood' });
orders.push({id:'a11', customer_id:'a', completed:false, origin:'whatsapp'});
orders.push({id:'b0', customer_id:'b', completed:true, origin:'site'});
orders.push({id:'a-excl', customer_id:'a', completed:true, exclude_customer_metrics:true, origin:'site'});
function legacy(list, customerId, current) {
  if (!customerId) return { completedOrders:0, directCompletedOrders:0, tier:null, milestone:null };
  const isIfood = d => d.origin === 'ifood' || (!d.origin && Boolean(d.ifood_id || d.order_id));
  const history = list.filter(d => d.customer_id === customerId && d.completed === true && d.exclude_customer_metrics !== true && d.id !== current?.id);
  const count = history.length; const direct = history.filter(d => !isIfood(d)).length;
  const eligible = Boolean(current && current.exclude_customer_metrics !== true && !isIfood(current));
  const ordinal = direct + Number(eligible);
  return { completedOrders:count,directCompletedOrders:direct,tier:count>=10?'super':count>=5?'frequente':null,milestone:eligible&&ordinal>=10&&ordinal%10===0?ordinal:null };
}
for (const current of [undefined, orders[0], orders[1], orders[11], orders[13], {id:'not-listed',customer_id:'a',origin:'site'}]) {
  const actual=compute(orders,'a',current), expected=legacy(orders,'a',current);
  for(const key of Object.keys(expected)) assert.equal(actual[key],expected[key],`${key} (${current?.id})`);
}
const fresh=[...orders,{id:'new',customer_id:'a',completed:true,origin:'site'}];
assert.equal(compute(fresh,'a').completedOrders,12,'lista nova invalida cache anterior');
assert.equal(compute(orders,'a').completedOrders,11,'cache da lista anterior permanece íntegro');
assert.equal(compute(orders,'b').completedOrders,1);
assert.equal(compute(orders,'missing').completedOrders,0);

for (const source of [card, recurrence, notifier]) {
  assert.ok(!/\b(onSnapshot|runTransaction|collection\()/.test(source),'UX não pode acrescentar consultas Firebase');
}
console.log('V105: drag seguro, recorrência indexada e alertas de estoque aprovados');
