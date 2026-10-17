const fs=require('fs'),assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const card=read('components/home/DeliveryCard.tsx'),queue=read('components/store/OperationalAttentionQueue.tsx'),settlement=read('app/motoboys/acerto/page.tsx');
assert(card.includes('deriveDeliveryPaymentState(item)'));assert(card.includes("paymentState === 'paid'"));assert(card.includes("paymentState === 'pending' ? 'Pix pendente'"));
assert(!card.includes('Pago no App'));assert(!card.includes('Pago App'));assert(!card.includes('QR Code Maquininha'));
assert(queue.includes('kindPriority'));assert(queue.includes('const counts=useMemo'));assert(queue.includes('new Set(tasks.map(task=>task.deliveryId)).size'));
assert(settlement.includes('AGUARDANDO CONFERÊNCIA'));assert(settlement.includes('ACERTO REGISTRADO'));
console.log('V89.7 — cards, financeiro canônico, prioridades e acerto: OK');
