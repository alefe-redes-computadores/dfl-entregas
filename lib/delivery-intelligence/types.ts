// lib/delivery-intelligence/types.ts
import type { Customer, Delivery, Motoboy, Route, StockSupply } from '@/types';

export type InsightSeverity = 'positive' | 'info' | 'attention' | 'warning';
export type InsightConfidence = 'low' | 'medium' | 'high';

export type InsightCategory =
  | 'data-quality'
  | 'demand'
  | 'geography'
  | 'routes'
  | 'stock';

export interface IntelligenceEvidence {
  label: string;
  value: string;
}

export interface IntelligencePeriodContext {
  startKey: string;
  endKey: string;
  label?: string;
}

export interface IntelligenceComparison {
  label: string;
  baseline: number;
  observed: number;
  unit?: string;
}

export interface OperationalInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  explanation: string;
  sampleSize: number;
  evidence: IntelligenceEvidence[];
  entityIds?: string[];

  /**
   * Janela que produziu o insight.
   * Evita mostrar uma conclusão sem dizer a qual período pertence.
   */
  period?: IntelligencePeriodContext;

  /**
   * Comparação quantitativa quando o insight depende
   * explicitamente de baseline.
   */
  comparison?: IntelligenceComparison;
}

export type OperationalIntelligenceWindowInput =
  | {
      mode: 'bounded';
      startKey: string;
      endKey: string;
    }
  | {
      mode: 'all';
    };

export interface OperationalIntelligenceInput {
  deliveries: Delivery[];
  routes: Route[];
  customers: Customer[];
  motoboys: Motoboy[];
  stockSupplies: StockSupply[];
  now?: Date;
  lookbackDays?: number;
  minimumSample?: number;
  window?: OperationalIntelligenceWindowInput;
  includeUndatedQuality?: boolean;
}

export interface IntelligenceWindow {
  mode: 'lookback' | 'bounded' | 'all';
  startKey: string;
  endKey: string;
  lookbackDays: number;
}

export interface NeighborhoodHourPattern {
  neighborhood: string;
  hour: number;
  deliveries: number;
  neighborhoodSample: number;
  shareWithinNeighborhood: number;
}

export interface RecurringCustomerPattern {
  customerId: string;
  customerName: string;
  deliveries: number;
  distinctAddresses: number;
  dominantAddress: string | null;
  dominantAddressCount: number;
  addressConsistency: number;
  hasStructuredNeighborhood: boolean;
  hasMapsLink: boolean;

  lastOrderDateKey: string | null;
  medianIntervalDays: number | null;
}

export interface RouteOperationalContext {
  routeId: string;
  routeName: string;
  motoboyId: string | null;
  motoboyName: string;
  durationMinutes: number;
  deliveryCount: number;
  sizeBand: string;
  departureHour: number | null;
  comparisonSample: number;
  baselineMinutes: number | null;
  thresholdMinutes: number | null;
  deviationRatio: number | null;
  contextStatus: 'insufficient' | 'within' | 'above';
}

export interface MotoboyOperationalContext {
  motoboyId: string | null;
  motoboyName: string;
  routeCount: number;
  deliveryCount: number;
  medianRouteDurationMinutes: number | null;
  averageDeliveriesPerRoute: number;
}

export interface RouteGapPattern {
  motoboyId: string | null;
  motoboyName: string;
  sampleSize: number;
  medianGapMinutes: number;
  shortestGapMinutes: number;
  longestGapMinutes: number;
}

export interface NeighborhoodTransitionPattern {
  key: string;
  fromNeighborhood: string;
  toNeighborhood: string;
  occurrences: number;
  timingSample: number;
  medianCompletionIntervalMinutes: number | null;
}

export interface TransitionObservationAnomaly {
  routeId: string;
  fromDeliveryId: string;
  toDeliveryId: string;

  fromNeighborhood: string;
  toNeighborhood: string;

  observedMinutes: number;
  baselineMinutes: number;
  comparisonSample: number;
  deviationRatio: number;
}

export interface RouteSequenceMemory {
  patterns: NeighborhoodTransitionPattern[];
  anomalies: TransitionObservationAnomaly[];

  coverage: {
    orderedPairs: number;
    timedPairs: number;
  };
}

export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
  routeSequences: RouteSequenceMemory;
}

export interface PreRouteTransitionMatch {
  fromDeliveryId: string;
  toDeliveryId: string;
  fromNeighborhood: string;
  toNeighborhood: string;

  historicalOccurrences: number;
  timingSample: number;
  medianCompletionIntervalMinutes: number | null;
}

export interface PreRouteContext {
  routeId: string;
  routeName: string;

  deliveryCount: number;
  orderedDeliveryCount: number;

  neighborhoodCount: number;
  distinctNeighborhoods: number;
  neighborhoodCoverage: number;

  transitions: PreRouteTransitionMatch[];

  knownTransitionCount: number;
  timedTransitionCount: number;

  historicalTransitionCoverage: number;

  status:
    | 'empty'
    | 'limited-data'
    | 'forming'
    | 'partial-history'
    | 'well-known';
}

export interface OperationalIntelligenceSnapshot {
  generatedAt: string;
  window: IntelligenceWindow;
  memory: OperationalMemory;
  insights: OperationalInsight[];
  summary: {
    positive: number;
    info: number;
    attention: number;
    warning: number;
    total: number;
  };
  coverage: {
    datedDeliveries: number;
    undatedDeliveries: number;
    deliveryRecords: number;
    structuredNeighborhoods: number;
    routedDeliveries: number;
    stockSupplyRecords: number;
    stockSupplyItems: number;
    stockSupplyWithPurchaser: number;
    stockSupplyChecked: number;
  };
}
