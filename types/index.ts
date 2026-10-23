export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'cartao';

export type DeliveryPaymentState =
  | 'paid'
  | 'collect_on_delivery'
  | 'pending';
export type RouteStatus = 'aberta' | 'fechada';
export type OrderOrigin = 'ifood' | 'food99' | 'loja';
export type IntegrationSourceSystem = 'dfl_site' | 'dfl_entregas';
export type FulfillmentMode = 'delivery' | 'external_delivery' | 'pickup' | 'counter';
export type LogisticsProvider = 'dfl' | 'ifood' | 'food99' | 'customer';
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

export type StockSupplierType = 'supermercado' | 'embalagens' | 'acougue' | 'gas' | 'hortifruti' | 'distribuidor' | 'padaria' | 'motoboy' | 'outro';

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
  shopping_started_at?: string;
  shopping_completed_at?: string;
  stock_integrated_at?: string;
  stock_reversed_at?: string;
  created_at: string;
  updated_at: string;
}

export type OperationalExpenseType = 'motoboy' | 'frete' | 'manutencao' | 'taxa' | 'alimentacao' | 'servico' | 'material' | 'outro';

export type MotoboySettlementAdjustmentDirection = 'deduction' | 'addition';

export interface MotoboySettlementCategory {
  id: string;
  label: string;
  direction: MotoboySettlementAdjustmentDirection;
  position: number;
  custom?: boolean;
}

export interface MotoboySettlementAdjustment {
  id: string;
  kind: 'meal' | 'advance' | 'fuel' | 'consumption' | 'tip' | 'extra_fee' | 'gratification' | 'extra_service' | 'bread_pickup' | 'addition' | 'other' | 'custom';
  direction?: MotoboySettlementAdjustmentDirection;
  category_id?: string;
  category_label?: string;
  description: string;
  amount: number;
}

export type MotoboyAdjustmentStatus = 'pending' | 'cancelled' | 'incorporated';

export interface MotoboyAdjustment extends MotoboySettlementAdjustment {
  motoboy_id: string;
  motoboy_name: string;
  operational_date: string;
  status: MotoboyAdjustmentStatus;
  author_uid?: string;
  author_name?: string;
  settlement_source_id?: string;
  incorporated_at?: string;
  cancelled_at?: string;
  cancelled_by_uid?: string;
  created_at: string;
  updated_at: string;
}

export interface OperationalExpense {
  id: string;
  occurred_at: string;
  type: OperationalExpenseType;
  description: string;
  amount: number;
  motoboy_id?: string;
  motoboy_name?: string;
  source_kind?: 'motoboy_settlement' | 'manual';
  source_id?: string;
  operational_date?: string;
  schema_version?: number;
  closed_by_uid?: string;
  closed_by_name?: string;
  settlement_gross_amount?: number;
  /** Valor financeiro do acerto depois de ajustes reais, sem compensar dinheiro das entregas. */
  settlement_net_payable?: number;
  /** Valor efetivamente transferido entre loja e motoboy no fechamento de caixa. */
  settlement_cash_balance?: number;
  settlement_adjustments?: MotoboySettlementAdjustment[];
  settlement_delivery_count?: number;
  settlement_route_count?: number;
  /** Valor líquido das vendas em dinheiro que pertence à loja. */
  settlement_cash_collected?: number;
  /** Dinheiro bruto recebido dos clientes, antes do troco. */
  settlement_cash_tendered?: number;
  /** Total físico que ficou sob responsabilidade do motoboy. */
  settlement_cash_in_hand?: number;
  /** Troco devolvido aos clientes nas entregas. */
  settlement_cash_change?: number;
  /** Parcela do dinheiro físico recebido efetivamente entregue à loja. */
  settlement_cash_handed_over_amount?: number;
  settlement_cash_retained?: number;
  settlement_store_credit?: number;
  settlement_motoboy_credit?: number;
  /** Só transporta o saldo quando o caixa não foi quitado neste fechamento. */
  settlement_carry_forward?: boolean;
  settlement_direction?: 'store_credit' | 'motoboy_credit' | 'settled';
  settlement_cash_handed_over?: boolean;
  /** Caixa separado, compensação da diária ou conferência manual. */
  settlement_strategy?: 'separate' | 'offset' | 'manual';
  observation?: string;
  created_at: string;
  updated_at: string;
}

export type TeamMemberRole = 'administracao' | 'compras' | 'cozinha' | 'atendimento' | 'entrega' | 'outro';

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  phone?: string;
  photo_url?: string;
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
  /** Dias normalmente necessários entre decidir comprar e o item chegar. */
  lead_time_days?: number;
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
  /** Rastreabilidade de baixas sugeridas pela operação, sem nova consulta. */
  source_kind?: 'delivery_beverage_review';
  source_delivery_ids?: string[];
  source_labels?: string[];
  source_confidence?: 'alta' | 'media';
  supply_id?: string;
  team_member_id?: string;
  team_member_name?: string;
  team_member_photo_url?: string;
  presentation_id?: string;
  presentation_label?: string;
  presentation_quantity?: number;
  presentation_unit?: StockSupplyUnit;
  conversion_quantity?: number;
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
  started_by_uid?: string;
  started_by_name?: string;
  started_by_email?: string;
  end_time?: string;
  reopened_at?: string;
  auto_closed_at?: string;
  change_money: number;
  drinks_summary?: string;
  created_at?: string;
  /** Competência imutável da operação; eventos após meia-noite continuam neste dia. */
  operational_date?: string;
  updated_at?: string;
}

export interface SiteOrderAddonSnapshot {
  id?: string;
  name: string;
  price: number;
}

export interface SiteOrderItemSnapshot {
  id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  selected_addons: SiteOrderAddonSnapshot[];
  observation?: string;

  // Snapshot rico preservado do pedido do DFL Site.
  unitPrice?: number;
  lineTotal?: number;
  detailsTitle?: string | null;
  detailsItems?: string[];
  includedExtras?: string | null;
  selectedAddons?: SiteOrderAddonSnapshot[];
}

export interface SiteOrderCommercialSnapshot {
  schema_version: 1;
  items: SiteOrderItemSnapshot[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  coupon_code?: string;
  reward_id?: string;
  total: number;
  payment_method_raw: string;
  change_for?: number;
  scheduled: boolean;
}

export interface SiteOrderTimelineEntry {
  event_id: string;
  status: string;
  occurred_at: string;
}

export interface Delivery {
  id: string;
  route_id: string;
  fulfillment_mode?: FulfillmentMode; // legado sem campo = delivery
  /** Responsável físico pela entrega. Ausente em registros legados = DFL. */
  logistics_provider?: LogisticsProvider;
  /** Prontidão real da retirada; não equivale à conclusão. */
  pickup_ready_at?: string | null;
  stop_group_id?: string;
  customer_charge?: number;
  ifood_subsidy?: number;
  order_id?: string;
  ifood_id?: string;

  /**
   * Origem TÉCNICA de um registro integrado.
   *
   * Não substitui `origin`:
   * - origin = canal/comercial (loja | ifood)
   * - source_system = sistema que originou tecnicamente o registro
   *
   * Entregas locais/legadas continuam válidas sem este campo.
   */
  source_system?: IntegrationSourceSystem;

  /**
   * ID do pedido no sistema externo.
   *
   * Para DFL Site:
   * corresponde ao ID de Pedidos/{id}.
   *
   * Não reutilizamos `order_id`, pois esse campo já participa
   * do domínio operacional/iFood existente.
   */
  external_order_id?: string;

  /**
   * Versão do contrato do pedido recebido do sistema externo.
   * Ex.: orderSchemaVersion do DFL Site.
   */
  external_order_schema_version?: number;
  /** Snapshot comercial somente-leitura recebido do DFL Site. */
  site_order_commercial?: SiteOrderCommercialSnapshot;
  site_order_status?: string;
  site_order_status_updated_at?: string | null;
  site_order_last_event_at?: string;
  site_order_last_event_id?: string;
  /** Histórico compacto e idempotente dos estados enviados pelo Site. */
  site_order_timeline?: SiteOrderTimelineEntry[];
  site_order_items?: SiteOrderItemSnapshot[];
  site_order_subtotal?: number;
  site_order_delivery_fee?: number;
  site_order_discount?: number;
  site_order_coupon?: string | null;
  site_order_reward_id?: string | null;

  origin: OrderOrigin;
  confirmation_code?: string;
  customer_id: string;
  value: number;
  is_paid: boolean;
  payment_method: PaymentMethod;
  /**
   * Estado financeiro operacional explícito.
   * Registros legados continuam válidos: a camada financeira deriva o estado
   * a partir de is_paid + payment_method quando este campo não existir.
   */
  payment_state?: DeliveryPaymentState;
  change_for?: number;
  address_string: string;
  maps_link: string;
  observation?: string;
  /** Registro persistido de tentativa, independente de baixa e confirmação externa. */
  delivery_attempts?: import('@/lib/delivery-attempts').DeliveryAttempt[];
  drinks?: string;
  /** A edição humana de Bebidas prevalece sobre projeções posteriores do Site. */
  drinks_manual_override?: boolean;
  drinks_manual_override_at?: string;
  /** Último texto calculado do Site, mantido para auditoria sem apagar a correção humana. */
  site_order_drinks_snapshot?: string;
  completed?: boolean;
  order_index?: number;
  order_locked?: boolean;
  order_source?: 'manual' | 'smart';
  order_updated_at?: string;
  is_urgent?: boolean;
  phone?: string;
  notify_whatsapp?: boolean;
  customer_name?: string;
  /** Preserva a venda, mas exclui ranking/recorrência de cliente. */
  exclude_customer_metrics?: boolean;
  /** Pedido criado pelo proprietário para teste; nunca entra em métricas de cliente. */
  developer_test?: boolean;
  /** Contexto explícito quando a identidade do proprietário/loja é usada no pedido. */
  owner_order_context?: 'customer' | 'owner_test' | 'owner_provisional' | 'store_pickup';
  external_customer_id?: string;
  customer_email?: string;
  createdAt?: string; // Campo legado ainda lido pelos relatórios atuais
  created_at?: string;
  completed_at?: string;
  /** Fila explícita de projeção analítica; evita varrer o histórico inteiro. */
  analytics_sync_pending?: boolean;
  analytics_sync_requested_at?: string;
  analytics_synced_at?: string;
  /**
   * Retirada excepcional da fila operacional.
   * Não significa entrega concluída e não apaga o histórico comercial.
   */
  operational_dismissed_at?: string;
  operational_dismissal_reason?: string;
  operational_dismissal_source?: 'manual';
  operational_completion_source?: 'dfl_site' | 'dfl_entregas';
  operational_completion_pending_route?: boolean;
  scheduled_for?: string | null;
  scheduled_label?: string | null;
  schedule_window_minutes?: number | null;
  schedule_release_at?: string | null;
  updated_at?: string;
}

export interface CustomerPhone { id: string; number: string; label?: string; primary?: boolean; }
export interface CustomerAddress { id: string; address: string; neighborhood?: string; maps_link?: string; reference?: string; label?: string; primary?: boolean; }

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  phones?: CustomerPhone[];
  addresses?: CustomerAddress[];
  internal_owner_verified?: boolean;
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
  internal_owner_verified?: boolean;
  /** Responsavel por confirmar no portal: ausente = loja (legado). */
  ifood_confirmation_mode?: 'store' | 'motoboy';
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

  // Vínculo operacional. Pendências antigas continuam válidas sem estes campos.
  delivery_id?: string;
  route_id?: string;
  route_name?: string;
  source_kind?: 'route' | 'manual';

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
