// ============================================================================
// DFL Entregas — Tipagens Globais
// ============================================================================

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'cartao';
export type RouteStatus = 'aberta' | 'fechada';
export type OrderOrigin = 'ifood' | 'loja';
export type PaymentRuleType = 'fixed' | 'per_delivery' | 'fixed_plus_variable';
export type MotoboyType = 'fixo' | 'avulso'; 

export interface MotoboyPaymentRule {
  type: PaymentRuleType;
  fixed_amount?: number;    // Ex: R$ 100
  delivery_fee?: number;    // Ex: R$ 6 por entrega
  threshold?: number;       // Ex: 15 entregas (limite da base fixa)
  extra_fee?: number;       // Ex: R$ 7 por entrega após o limite
}

export interface Route {
  id: string;
  name: string;
  status: RouteStatus;
  motoboy_name: string;
  departure_time: string;
  started_at?: string;
  end_time?: string;
  change_money: number;
  drinks_summary?: string;
  updated_at?: string;
}

export interface Delivery {
  id: string;
  route_id: string;
  order_id?: string;
  ifood_id?: string; // 🔥 ADICIONADO: O ID de 8 dígitos do iFood
  origin: OrderOrigin;
  confirmation_code?: string; // Mantido para o código de 4 dígitos
  customer_id: string;
  value: number;
  is_paid: boolean;
  payment_method: PaymentMethod;
  change_for?: number;
  address_string: string;
  maps_link: string;
  observation?: string;
  drinks?: string;
  completed?: boolean;
  order_index?: number; 
  is_urgent?: boolean; 
  updated_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  origin?: OrderOrigin;
  neighborhood?: string;
  address?: string;
  maps_link?: string;
  observation?: string;
  last_confirmation_code?: string;
  avatar?: string; // 🔥 ADICIONADO: Avatar do cliente (Emoji)
  createdAt?: string;
  updated_at?: string;
  orderCount?: number; 
  totalSpent?: number; 
}

export interface Motoboy {
  id: string;
  name: string;
  active: boolean; 
  type?: MotoboyType; 
  avatar?: string; // 🔥 ADICIONADO: Avatar do motoboy (Emoji)
  payment_rule?: MotoboyPaymentRule; 
  createdAt?: string;
  updated_at?: string;
}
