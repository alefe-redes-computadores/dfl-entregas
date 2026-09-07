const TIME_ZONE = 'America/Sao_Paulo';

type TimestampLike =
  | string
  | number
  | Date
  | { toDate?: () => Date; seconds?: number }
  | null
  | undefined;

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function parseTimestamp(value: TimestampLike): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      return Number.isFinite(date.getTime()) ? date : null;
    }
    if (typeof value.seconds === 'number') {
      const date = new Date(value.seconds * 1000);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parts(date: Date) {
  const mapped = Object.fromEntries(
    dateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour === '24' ? '0' : mapped.hour),
  };
}

export function saoPauloDateKey(date: Date): string {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function saoPauloHour(date: Date): number {
  return parts(date).hour;
}

export function formatReportDate(date: Date): string {
  return dateFormatter.format(date);
}

export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00-03:00`);
}

export function shiftDateKey(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return saoPauloDateKey(date);
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function enumerateDateKeys(startKey: string, endKey: string): string[] {
  const result: string[] = [];
  let cursor = startKey;
  let guard = 0;

  while (compareDateKeys(cursor, endKey) <= 0 && guard < 5000) {
    result.push(cursor);
    cursor = shiftDateKey(cursor, 1);
    guard += 1;
  }

  return result;
}

export function weekdayIndexFromKey(key: string): number {
  return dateFromKey(key).getDay();
}

export function todayKey(): string {
  return saoPauloDateKey(new Date());
}
