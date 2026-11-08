/** Recomendacao explicavel, nunca score de fraude, bloqueio ou mudanca de cobranca. */
import type { Customer, Delivery } from '@/types';
export type PaymentGuidance = {
  level: 'prepaid_recommended'|'review'|'none';
  title:string;
  explanation:string;
  referenceIds:string[];
};
const financialWords=/\b(pix|pagamento|pagar|cobran[cç]a|recebimento|pendente|n[aã]o pagou|inadimpl)/i;
export function customerPaymentGuidance(customer:Pick<Customer,'operational_review'>,deliveries:readonly Delivery[]):PaymentGuidance{
  const review=customer.operational_review;
  if(!review || review.state!=='observacao')return {level:'none',title:'Sem recomendação de cobrança',explanation:'Não existe observação operacional ativa.',referenceIds:[]};
  const relatedId=review.events?.filter(e=>e.state==='observacao'&&financialWords.test(e.reason)).slice(-1)[0]?.related_delivery_id;
  const explicitFinancialReview=financialWords.test(review.reason||'') && Boolean(relatedId);
  const pending=deliveries.filter(d=>d.completed===true && d.is_paid!==true &&
    d.payment_state!=='paid' && d.id===relatedId);
  if(explicitFinancialReview&&pending.length){return {
    level:'prepaid_recommended',title:'Pagamento antecipado recomendado',
    explanation:'Ocorrência financeira documentada e vinculada a pedido concluído sem confirmação de recebimento. Confirme o histórico antes de aceitar nova cobrança na entrega. Não bloquear automaticamente.',
    referenceIds:pending.map(d=>d.id),
  };}
  return {level:'review',title:'Conferir ocorrência antes de nova venda',
    explanation:'Existe uma observação humana. Falta evidência financeira vinculada suficiente para recomendar pagamento antecipado automaticamente.',
    referenceIds:relatedId?[relatedId]:[]};
}
