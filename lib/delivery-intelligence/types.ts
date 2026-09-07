// lib/delivery-intelligence/types.ts
import type { Customer, Delivery, Fueling, Motoboy, Route } from '@/types';

export type InsightSeverity = 'positive' | 'info' | 'attention' | 'warning';
export type InsightConfidence = 'low' | 'medium' | 'high';

export type InsightCategory =
  | 'data-quality'
  | 'demand'
  | 'geography'
  | 'routes'
  | 'fuel';

export interface IntelligenceEvidence {
  label: string;
  value: string;
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
  fuelings: Fueling[];
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

export interface OperationalIntelligenceSnapshot {
  generatedAt: string;
  window: IntelligenceWindow;
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
    fuelRecords: number;
    fuelWithLiters: number;
    fuelWithVehicle: number;
    fuelWithOdometer: number;
  };
}
