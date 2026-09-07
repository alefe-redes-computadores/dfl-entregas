import type { Customer, Delivery, Fueling, Route } from '@/types';

export type ReportPeriodKey = 'today' | '7d' | '14d' | '30d' | 'all';

export type ReportDelivery = Delivery & {
  reportDate: Date | null;
  reportDateKey: string | null;
  reportHour: number | null;
  route: Route | null;
  customer: Customer | null;
  neighborhood: string | null;
  originLabel: 'iFood' | 'Loja' | 'Origem não registrada';
  paymentLabel: string;
};

export interface ReportPeriod {
  key: ReportPeriodKey;
  label: string;
  start: Date | null;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
}

export interface ReportBucket {
  key: string;
  label: string;
  count: number;
  revenue: number;
  average?: number;
  sampleSize?: number;
}

export interface DailyBucket extends ReportBucket {
  dateKey: string;
}

export interface RouteTimingRow {
  routeId: string;
  routeName: string;
  motoboyName: string;
  durationMinutes: number;
  deliveryCount: number;
}

export interface DataQualityIssue {
  key:
    | 'missing-date'
    | 'missing-origin'
    | 'missing-payment'
    | 'missing-neighborhood'
    | 'missing-route'
    | 'suspicious-route-time';
  label: string;
  count: number;
  description: string;
}


export interface FuelReportModel {
  current: Fueling[];
  previous: Fueling[];
  metrics: {
    totalAmount: number;
    liters: number;
    averagePricePerLiter: number;
    averageFueling: number;
    count: number;
    spendVariation: number | null;
    litersCoverageCount: number;
    odometerCoverageCount: number;
    vehicleCoverageCount: number;
  };
  dailySpend: DailyBucket[];
  byFuelType: ReportBucket[];
  byVehicle: ReportBucket[];
}

export interface ReportModel {
  period: ReportPeriod;
  deliveries: ReportDelivery[];
  previousDeliveries: ReportDelivery[];
  metrics: {
    totalDeliveries: number;
    totalRevenue: number;
    averageTicket: number;
    deliveryVariation: number | null;
    revenueVariation: number | null;
    validDateCount: number;
    ignoredDateCount: number;
  };
  dailyVolume: DailyBucket[];
  dailyRevenue: DailyBucket[];
  payments: ReportBucket[];
  origins: ReportBucket[];
  hours: ReportBucket[];
  weekdays: ReportBucket[];
  neighborhoods: ReportBucket[];
  motoboys: ReportBucket[];
  routeTimings: RouteTimingRow[];
  fuel: FuelReportModel;
  quality: DataQualityIssue[];
}

export type DrilldownKind =
  | 'daily'
  | 'payment'
  | 'origin'
  | 'hour'
  | 'weekday'
  | 'neighborhood'
  | 'motoboy'
  | 'route'
  | 'quality';

export interface DrilldownSelection {
  kind: DrilldownKind;
  key?: string;
  title: string;
  subtitle?: string;
}
