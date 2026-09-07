// lib/operational-time.ts
import type { DaySchedule, Shift, StorePause } from '@/types';
import { firstValidTimestamp } from '@/lib/reports/time';

export const OPERATION_TIME_ZONE = 'America/Sao_Paulo';
export const dateKey = (value: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value));
export const dateFromKey = (key:string) => new Date(`${key}T12:00:00-03:00`);
export const shiftDateKey = (key:string, amount:number) => { const date=dateFromKey(key); date.setDate(date.getDate()+amount); return dateKey(date); };
export const deliveryDate = (delivery:{created_at?:string;createdAt?:string}) =>
  firstValidTimestamp(delivery.created_at, delivery.createdAt)?.toISOString() || '';
export const routeDate = (route:{created_at?:string;started_at?:string;departure_time?:string}) =>
  firstValidTimestamp(route.created_at, route.started_at, route.departure_time)?.toISOString() || '';
export const minutes = (time:string) => { const match=/^(\d{2}):(\d{2})$/.exec(time); if(!match)return -1; const value=Number(match[1])*60+Number(match[2]); return Number(match[1])<24&&Number(match[2])<60?value:-1; };
export const validShift = (shift:Shift) => minutes(shift.start)>=0 && minutes(shift.end)>=0 && shift.start!==shift.end;

export function validateSchedule(day:DaySchedule):string|null {
  if(!day.active)return null;
  if(!day.shifts.length)return 'Adicione pelo menos um turno.';
  if(day.shifts.some(shift=>!validShift(shift)))return 'Todo turno precisa ter início e término diferentes.';
  const ranges=day.shifts.map(shift=>{const start=minutes(shift.start);let end=minutes(shift.end);if(end<start)end+=1440;return {start,end};}).sort((a,b)=>a.start-b.start);
  for(let index=1;index<ranges.length;index+=1)if(ranges[index].start<ranges[index-1].end)return 'Existem turnos sobrepostos.';
  return null;
}

export function isPausedOn(pauses:StorePause[]|undefined,key:string){return Boolean(pauses?.some(pause=>key>=pause.start_date.slice(0,10)&&key<=pause.end_date.slice(0,10)));}

export function isWithinSchedule(now:Date,schedule:Record<number,DaySchedule>|undefined,pauses:StorePause[]|undefined){
  const key=dateKey(now); if(isPausedOn(pauses,key)||!schedule)return false;
  const local=new Intl.DateTimeFormat('en-US',{timeZone:OPERATION_TIME_ZONE,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const weekday=local.find(part=>part.type==='weekday')?.value; const map:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}; const day=map[weekday||'Sun'];
  const current=Number(local.find(part=>part.type==='hour')?.value)*60+Number(local.find(part=>part.type==='minute')?.value);
  const today=schedule[day]; if(today?.active&&today.shifts.some(shift=>{const start=minutes(shift.start),end=minutes(shift.end);return end>start?current>=start&&current<end:current>=start;}))return true;
  const previous=schedule[(day+6)%7]; return Boolean(previous?.active&&previous.shifts.some(shift=>{const start=minutes(shift.start),end=minutes(shift.end);return end<start&&current<end;}));
}
