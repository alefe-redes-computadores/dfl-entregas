// lib/stock.ts
import type { StockProduct, StockMovement } from '@/types';

export const stockLevel = (product: StockProduct) => product.current_quantity <= 0 ? 'zero' : product.current_quantity <= product.minimum_quantity ? 'baixo' : 'ok';
export const stockValue = (products: StockProduct[]) => products.reduce((sum, product) => sum + product.current_quantity * (product.average_cost || 0), 0);
export const replenishmentTarget = (product: StockProduct) => Math.max(product.minimum_quantity, product.ideal_quantity || 0);
export const purchaseSuggestion = (product: StockProduct) => Math.max(0, replenishmentTarget(product) - product.current_quantity);
export const recentMovements = (items: StockMovement[], productId: string) => items.filter((item) => item.product_id === productId).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
