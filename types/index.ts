export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'cartao';
export type RouteStatus = 'aberta' | 'fechada';
export type OrderOrigin = 'ifood' | 'loja';
export type FulfillmentMode = 'delivery' | 'pickup' | 'counter';
export type PaymentRuleType = 'fixed' | 'per_delivery' | 'fixed_plus_variable';
export type MotoboyType = 'fixo' | 'avulso';
export type FuelType = 'gasolina_comum' | 'gasolina_aditivada' | 'etanol' | 'diesel' | 'outro';

export interface Fueling {
  id: string;
  occurred_at: string;
  fuel_type: FuelType;
  total_amount: number;
  liters?: number;
  price_per_liter?: number;
  odometer_km?: number;
  station?: string;
  vehicle_label?: string;
  motoboy_id?: string;
  motoboy_name?: string;
  observation?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MotoboyPaymentRule {
  type: PaymentRuleType;
  fixed_amount?: number;    
  delivery_fee?: number;    
  threshold?: number;       
  extra_fee?: number;       
}

export interface Route {
  id: string;
  name: string;
  status: RouteStatus;
  motoboy_name: string;
  motoboy_id?: string;
  departure_time?: string; // Legado: novas rotas usam started_at como saída real
  started_at?: string;
  end_time?: string;
  reopened_at?: string;
  change_money: number;
  drinks_summary?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Delivery {
  id: string;
  route_id: string;
  fulfillment_mode?: FulfillmentMode; // legado sem campo = delivery
  order_id?: string;
  ifood_id?: string; 
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
  completed?: boolean;
  order_index?: number; 
  is_urgent?: boolean;
  phone?: string;
  notify_whatsapp?: boolean;
  customer_name?: string;
  createdAt?: string; // Campo legado ainda lido pelos relatórios atuais
  created_at?: string;
  completed_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  origin?: OrderOrigin;
  neighborhood?: string;
  address?: string;
  maps_link?: string;
  observation?: string;
  last_confirmation_code?: string;
  avatar?: string; 
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
  avatar?: string; 
  payment_rule?: MotoboyPaymentRule; 
  createdAt?: string;
  updated_at?: string;
}

export interface Shift {
  start: string;
  end: string;
}

export interface DaySchedule {
  active: boolean;
  shifts: Shift[];
}

export interface StorePause {
  id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface HolidayOverride {
  date: string;
  active: boolean;
  shifts: Shift[];
}
