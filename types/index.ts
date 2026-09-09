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

export type StockSupplyStatus = 'solicitado' | 'em_compra' | 'recebido' | 'conferido';
export type StockSupplyUnit = 'un' | 'kg' | 'g' | 'l' | 'ml' | 'cx' | 'pct' | 'fardo';

export type StockSupplierType = 'supermercado' | 'embalagens' | 'acougue' | 'gas' | 'hortifruti' | 'distribuidor' | 'outro';

export interface StockSupplier {
  id: string;
  name: string;
  type: StockSupplierType;
  active: boolean;
  phone?: string;
  address?: string;
  observation?: string;
  created_at: string;
  updated_at: string;
}

export interface StockProductPresentation {
  id: string;
  label: string;
  purchase_unit: StockSupplyUnit;
  conversion_quantity: number;
  active: boolean;
}

export interface StockSupplyItem {
  id: string;
  name: string;
  quantity: number;
  unit: StockSupplyUnit;
  unit_price?: number;
  total_price?: number;
  observation?: string;
  stock_product_id?: string;
  presentation_id?: string;
  presentation_label?: string;
  purchase_quantity?: number;
  purchase_unit?: StockSupplyUnit;
  conversion_quantity?: number;
  purchase_unit_price?: number;
}

export interface StockSupply {
  id: string;
  occurred_at: string;
  status: StockSupplyStatus;
  items: StockSupplyItem[];
  products_amount: number;
  transport_amount?: number;
  other_costs?: number;
  total_amount: number;
  supplier?: string;
  supplier_id?: string;
  payment_method?: PaymentMethod;
  purchaser_name?: string;
  purchaser_id?: string;
  observation?: string;
  received_at?: string;
  checked_at?: string;
  stock_integrated_at?: string;
  stock_reversed_at?: string;
  created_at: string;
  updated_at: string;
}

export type TeamMemberRole = 'administracao' | 'compras' | 'cozinha' | 'atendimento' | 'entrega' | 'outro';

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  phone?: string;
  active: boolean;
  observation?: string;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'entrada' | 'saida' | 'perda' | 'ajuste' | 'contagem';

export interface StockProduct {
  id: string;
  name: string;
  category?: string;
  unit: StockSupplyUnit;
  current_quantity: number;
  minimum_quantity: number;
  ideal_quantity?: number;
  average_cost?: number;
  active: boolean;
  observation?: string;
  last_counted_at?: string;
  icon?: string;
  color?: string;
  presentations?: StockProductPresentation[];
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  type: StockMovementType;
  quantity: number;
  balance_before: number;
  balance_after: number;
  unit_cost?: number;
  reason?: string;
  supply_id?: string;
  team_member_id?: string;
  team_member_name?: string;
  occurred_at: string;
  created_at: string;
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
  auto_closed_at?: string;
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
  order_locked?: boolean;
  order_source?: 'manual' | 'smart';
  order_updated_at?: string;
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

export type IfoodPendingConfirmationStatus = 'pending' | 'resolved';

export interface IfoodPendingConfirmation {
  id: string;
  order_id?: string;
  ifood_id?: string;
  confirmation_code?: string;
  customer_name?: string;
  value?: number;
  note?: string;
  status?: IfoodPendingConfirmationStatus;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
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
