import type { Delivery, Customer } from '@/types';

export function useOptimizedDeliveries(
  deliveries: Delivery[], 
  getCustomerById: (id: string) => Customer | undefined
) {
  // 1. Contador de Bairros para identificar "Vizinhos"
  const neighborhoodCounts = deliveries.reduce((acc, d) => {
    const cust = getCustomerById(d.customer_id);
    const neighborhood = cust?.neighborhood?.trim().toLowerCase();
    if (neighborhood) {
      acc[neighborhood] = (acc[neighborhood] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // 2. Ordenação Inteligente (Urgência -> Vizinhos/Proximidade -> Resto)
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    // Entregas já concluídas sempre descem para o fim da lista
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;

    // REGRA DE OURO 1: Urgência absoluta no topo absoluto
    const aUrgent = (a as any).is_urgent ? 1 : 0;
    const bUrgent = (b as any).is_urgent ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;

    // REGRA DE OURO 2: Agrupamento por proximidade (mesmo bairro/endereço encadeado)
    const custA = getCustomerById(a.customer_id);
    const custB = getCustomerById(b.customer_id);
    const nA = custA?.neighborhood?.trim().toLowerCase() || '';
    const nB = custB?.neighborhood?.trim().toLowerCase() || '';
    
    if (nA && nB && nA === nB) return -1;

    // Ordem manual ou cronológica padrão
    const timeA = new Date(a.updated_at || 0).getTime();
    const timeB = new Date(b.updated_at || 0).getTime();
    return (a.order_index ?? timeA) - (b.order_index ?? timeB);
  });

  const pendingDeliveries = sortedDeliveries.filter(d => !d.completed);

  return {
    sortedDeliveries,
    pendingDeliveries,
    neighborhoodCounts
  };
}
