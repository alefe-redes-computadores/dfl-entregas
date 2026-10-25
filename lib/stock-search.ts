import type { StockProduct } from '@/types';

export function normalizeStockSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string, maxDistance = Infinity) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    let rowMin = previous[0];
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
      rowMin = Math.min(rowMin, previous[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
  }
  return previous[b.length];
}

/** R107_BARCODE_SEARCH — busca local, sem consultas adicionais ou fuzzy em codigo numerico. */
export function stockSearchScore(product: StockProduct, query: string) {
  const needle = normalizeStockSearch(query);
  if (!needle) return 1;
  const name = normalizeStockSearch(product.name);
  const category = normalizeStockSearch(product.category || '');
  const barcode = normalizeStockSearch(product.barcode || '').replace(/ /g, '');
  const compactQuery = needle.replace(/ /g, '');
  // Codigo numerico nao usa fuzzy: evita selecionar produto com codigo parecido.
  if (barcode && compactQuery.length >= 4 && /^[a-z0-9]+$/.test(compactQuery)) {
    if (barcode === compactQuery) return 1400;
    if (barcode.startsWith(compactQuery)) return 1100 - (barcode.length - compactQuery.length);
  }
  const presentations = (product.presentations || [])
    .filter(entry => entry.active)
    .map(entry => normalizeStockSearch(entry.label || ''))
    .filter(Boolean);
  const haystack = `${name} ${category} ${presentations.join(' ')}`.trim();
  if (name === needle) return 1000;
  if (name.startsWith(needle)) return 800 - (name.length - needle.length);
  if (name.includes(needle)) return 650 - name.indexOf(needle);
  if (category.startsWith(needle)) return 500;
  if (haystack.includes(needle)) return 420;
  const queryTokens = needle.split(' ').filter(Boolean);
  const words = haystack.split(' ').filter(Boolean);
  let score = 0;
  for (const token of queryTokens) {
    // Um EAN nao pode virar outro produto por aproximacao textual.
    const numericCode = /^\d{6,}$/.test(token);
    const best = words.reduce((current, word) => {
      if (word.startsWith(token)) return Math.max(current, 90);
      if (numericCode) return current;
      const tolerance = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
      if (tolerance && word.length <= 40 && token.length <= 40 && Math.abs(word.length - token.length) <= tolerance) {
        const distance = editDistance(word, token, tolerance);
        if (distance <= tolerance) return Math.max(current, 70 - distance * 10);
      }
      return current;
    }, 0);
    if (!best) return 0;
    score += best;
  }
  return score;
}

export function rankStockProducts(products: StockProduct[], query: string) {
  const needle = normalizeStockSearch(query);
  if (!needle) return products;
  return products
    .map((product) => ({ product, score: stockSearchScore(product, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'pt-BR'))
    .map((entry) => entry.product);
}
