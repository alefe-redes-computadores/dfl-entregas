// ============================================================================
// DFL Entregas — Tipagens Globais
// ============================================================================

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';

export type RouteStatus = 'aberta' | 'fechada';

export type OrderOrigin = 'ifood' | 'loja';

export interface Route {
  id: string;
  name: string;
  status: RouteStatus;
  motoboy_name: string;
  departure_time: string;
  end_time?: string;
  change_money: number;
  drinks_summary?: string;
  updated_at?: string;
}

export interface Delivery {
  id: string;
  route_id: string;
  order_id?: string;
  origin: OrderOrigin;
  confirmation_code?: string;
  customer_id: string;
  value: number;
  is_paid: boolean;
  payment_method: PaymentMethod;
  change_for?: number;
  address_string: string;
  maps_link: string;
  observation?: string;
  drinks?: string;
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
  createdAt?: string;
  updated_at?: string;
}

// NOVO: Tipagem do Motoboy
export interface Motoboy {
  id: string;
  name: string;
  active: boolean; // Para no futuro você poder "ocultar" quem não trabalha mais aí
  createdAt?: string;
  updated_at?: string;
}
