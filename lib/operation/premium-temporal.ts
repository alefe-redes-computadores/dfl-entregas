/** Brazilian visual input only. Persisted dates remain ISO/local calendar values. No TZ conversion. */
export function maskBrDate(input: string): string {
  const d = String(input || '').replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}
export function maskBrClock(input: string): string {
  const d = String(input || '').replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
export function brDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day=Number(match[1]), month=Number(match[2]), year=Number(match[3]);
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year,month-1,day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
export function isoDateToBr(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  const br = `${match[3]}/${match[2]}/${match[1]}`;
  return brDateToIso(br) ? br : '';
}
export function brClockToHHMM(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return value;
}
export function brDateTimeToLocal(date: string, time: string): string | null {
  const d = brDateToIso(date), t = brClockToHHMM(time);
  return d && t ? `${d}T${t}` : null;
}
export function splitLocalDateTime(value: string): {date:string; time:string} {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match || !isoDateToBr(match[1]) || !brClockToHHMM(match[2])) return {date:'',time:''};
  return {date:isoDateToBr(match[1]),time:match[2]};
}
