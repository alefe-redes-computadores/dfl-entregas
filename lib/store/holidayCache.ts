/** R43: cache efêmero de feriados. Coalesce navegações; sem polling nem Firestore. */
export type HolidayItem = {date: string; name?: string; [key: string]: unknown};
let cache: {year: number; at: number; data: HolidayItem[]} | null = null;
let pending: {year: number; task: Promise<HolidayItem[]>} | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;
export async function loadHolidayCalendar(year: number): Promise<HolidayItem[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Ano inválido');
  const now = Date.now();
  if (cache?.year === year && now - cache.at < TTL_MS) return cache.data;
  if (pending?.year === year) return pending.task;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const task = (async () => {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {signal: controller.signal});
      if (!response.ok) throw new Error(`BrasilAPI respondeu ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Resposta de feriados inválida');
      const safe = data.filter((entry): entry is HolidayItem => !!entry && typeof entry === 'object' && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
      cache = {year, at: Date.now(), data: safe};
      return safe;
    } finally {
      clearTimeout(timeout);
    }
  })();
  pending = {year,task};
  try {return await task;} finally {if (pending?.task === task) pending = null;}
}
