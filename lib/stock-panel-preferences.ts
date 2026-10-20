/** Prefs locais são conveniência visual, nunca autoridade do estoque. */
export type StockPanelPrefsInput = { filter?: string | null; planningTab?: string | null; collapsed?: string | null };
export type StockPanelFilter = 'todos' | 'baixo' | 'zero';
export type StockPanelPlanningTab = 'dia' | 'montar';
export type StockPanelPreferences = {
  filter: StockPanelFilter;
  planningTab: StockPanelPlanningTab;
  collapsed: Record<string, boolean>;
};

export function parseStockPanelPreferences(input: StockPanelPrefsInput): StockPanelPreferences {
  const filter: StockPanelFilter = input.filter === 'baixo' || input.filter === 'zero' ? input.filter : 'todos';
  const planningTab: StockPanelPlanningTab = input.planningTab === 'montar' ? 'montar' : 'dia';
  let collapsed: Record<string, boolean> = {};
  try {
    const value: unknown = JSON.parse(input.collapsed || '{}');
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value).filter(([key, isCollapsed]) =>
        key.length > 0 && key.length < 150 && typeof isCollapsed === 'boolean'
      ).slice(0, 150);
      collapsed = Object.fromEntries(entries);
    }
  } catch { /* Preferências locais antigas podem estar corrompidas. */ }
  return { filter, planningTab, collapsed };
}
