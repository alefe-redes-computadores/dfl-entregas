// ============================================================================
// DFL Entregas — Tipagens Globais
// ============================================================================

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';

export type RouteStatus = 'aberta' | 'fechada';

export interface Route {
  id: string;
  name: string; // ex: "Rota 1"
  status: RouteStatus;
  motoboy_name: string;
  departure_time: string; // ISO datetime
  end_time?: string; // ISO datetime, preenchido ao fechar a rota
  change_money: number; // troco inicial que o motoboy saiu com
  drinks_summary?: string; // ex: "3 coca lata, 1 guaraná 2L"
}

export interface Delivery {
  id: string;
  route_id: string;
  order_id: string; // AGORA EM DESTAQUE: número do pedido (ex: 4 dígitos)
  confirmation_code?: string; // OPCIONAL: código de confirmação na entrega
  customer_id: string;
  value: number; // Valor do pedido
  is_paid: boolean; // já pago (ex: pix antecipado / cartão online)
  payment_method: PaymentMethod;
  change_for?: number; // troco para quanto, se payment_method === 'dinheiro'
  address_string: string; // "Rua, Número, Bairro"
  maps_link: string;
  observation?: string;
  drinks?: string; // ex: "2 coca lata"
}

export interface Customer {
  id: string;
  name: string;
  neighborhood: string;
  last_confirmation_code?: string;
}
