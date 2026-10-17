import type { StockProduct } from '@/types';

export function normalizeStockSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

export function stockSearchScore(product: StockProduct, query: string) {
  const needle = normalizeStockSearch(query);
  if (!needle) return 1;
  const name = normalizeStockSearch(product.name);
  const category = normalizeStockSearch(product.category || '');
  const haystack = `${name} ${category}`.trim();
  if (name === needle) return 1000;
  if (name.startsWith(needle)) return 800 - (name.length - needle.length);
  if (name.includes(needle)) return 650 - name.indexOf(needle);
  if (category.startsWith(needle)) return 500;
  if (haystack.includes(needle)) return 420;

  const queryTokens = needle.split(' ').filter(Boolean);
  const words = haystack.split(' ').filter(Boolean);
  let score = 0;
  for (const token of queryTokens) {
    const best = words.reduce((current, word) => {
      if (word.startsWith(token)) return Math.max(current, 90);
      const tolerance = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
      if (tolerance && Math.abs(word.length - token.length) <= tolerance) {
        const distance = editDistance(word, token);
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
