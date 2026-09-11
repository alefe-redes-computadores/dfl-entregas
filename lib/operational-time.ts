import type {
  DaySchedule,
  HolidayOverride,
  Shift,
  StorePause,
} from '@/types';
import { firstValidTimestamp } from '@/lib/reports/time';

export const OPERATION_TIME_ZONE = 'America/Sao_Paulo';

export const dateKey = (value: Date | string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

export const dateFromKey = (key: string) =>
  new Date(`${key}T12:00:00-03:00`);

export const shiftDateKey = (key: string, amount: number) => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
  return date.toISOString().slice(0, 10);
};

export const deliveryDate = (delivery: {
  created_at?: string;
  createdAt?: string;
}) =>
  firstValidTimestamp(delivery.created_at, delivery.createdAt)?.toISOString() ||
  '';

export const routeDate = (route: {
  created_at?: string;
  started_at?: string;
  departure_time?: string;
}) =>
  firstValidTimestamp(
    route.created_at,
    route.started_at,
    route.departure_time,
  )?.toISOString() || '';

export const routeStartedAt = (route: {
  started_at?: string;
  departure_time?: string;
}) =>
  firstValidTimestamp(route.started_at, route.departure_time)?.toISOString() ||
  '';

export const minutes = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return -1;
  const value = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? value : -1;
};

export const validShift = (shift: Shift) =>
  minutes(shift.start) >= 0 &&
  minutes(shift.end) >= 0 &&
  shift.start !== shift.end;

export function validateSchedule(day: DaySchedule): string | null {
  if (!day.active) return null;
  if (!day.shifts.length) return 'Adicione pelo menos um turno.';
  if (day.shifts.some((shift) => !validShift(shift))) {
    return 'Todo turno precisa ter início e término diferentes.';
  }

  const ranges = day.shifts
    .map((shift) => {
      const start = minutes(shift.start);
      let end = minutes(shift.end);
      if (end < start) end += 1440;
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end) {
      return 'Existem turnos sobrepostos.';
    }
  }

  return null;
}

export function isPausedOn(
  pauses: StorePause[] | undefined,
  key: string,
) {
  return Boolean(
    pauses?.some(
      (pause) =>
        key >= pause.start_date.slice(0, 10) &&
        key <= pause.end_date.slice(0, 10),
    ),
  );
}

function weekdayFromKey(key: string) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

export function operationalDaySchedule(
  key: string,
  schedule: Record<number, DaySchedule> | undefined,
  pauses: StorePause[] | undefined,
  holidaysOverrides?: Record<string, HolidayOverride>,
): DaySchedule | undefined {
  if (!schedule || isPausedOn(pauses, key)) return undefined;

  const holiday = holidaysOverrides?.[key];
  if (holiday) {
    return {
      active: holiday.active,
      shifts: holiday.shifts || [],
    };
  }

  return schedule[weekdayFromKey(key)];
}

function localParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATION_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  return {
    weekday: parts.find((part) => part.type === 'weekday')?.value || 'Sun',
    current:
      Number(parts.find((part) => part.type === 'hour')?.value) * 60 +
      Number(parts.find((part) => part.type === 'minute')?.value),
  };
}

export function isWithinSchedule(
  now: Date,
  schedule: Record<number, DaySchedule> | undefined,
  pauses: StorePause[] | undefined,
  holidaysOverrides?: Record<string, HolidayOverride>,
) {
  if (!schedule) return false;

  const key = dateKey(now);
  const { current } = localParts(now);
  const today = operationalDaySchedule(
    key,
    schedule,
    pauses,
    holidaysOverrides,
  );

  if (
    today?.active &&
    today.shifts.some((shift) => {
      const start = minutes(shift.start);
      const end = minutes(shift.end);
      return end > start
        ? current >= start && current < end
        : current >= start;
    })
  ) {
    return true;
  }

  const previousKey = shiftDateKey(key, -1);
  const previous = operationalDaySchedule(
    previousKey,
    schedule,
    pauses,
    holidaysOverrides,
  );

  return Boolean(
    previous?.active &&
      previous.shifts.some((shift) => {
        const start = minutes(shift.start);
        const end = minutes(shift.end);
        return end < start && current < end;
      }),
  );
}

function operationalDateTime(key: string, time: string) {
  return new Date(`${key}T${time}:00-03:00`);
}

export function nextOperationalClosingAt(
  now: Date,
  schedule: Record<number, DaySchedule> | undefined,
  pauses: StorePause[] | undefined,
  holidaysOverrides?: Record<string, HolidayOverride>,
) {
  if (!schedule) return null;

  const today = dateKey(now);
  const candidates: Date[] = [];

  for (let offset = -1; offset <= 2; offset += 1) {
    const key = shiftDateKey(today, offset);
    const day = operationalDaySchedule(
      key,
      schedule,
      pauses,
      holidaysOverrides,
    );
    if (!day?.active) continue;

    day.shifts.forEach((shift) => {
      if (!validShift(shift)) return;

      const start = operationalDateTime(key, shift.start);
      const endMinutes = minutes(shift.end);
      const startMinutes = minutes(shift.start);
      const endKey =
        endMinutes < startMinutes ? shiftDateKey(key, 1) : key;
      const end = operationalDateTime(endKey, shift.end);

      if (end.getTime() <= now.getTime()) return;

      // Se a operação já está dentro do turno, esta é a saída correta.
      // Se a rota foi aberta fora do horário, usa o próximo fechamento futuro.
      if (
        now.getTime() >= start.getTime() ||
        start.getTime() > now.getTime()
      ) {
        candidates.push(end);
      }
    });
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}
