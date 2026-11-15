#!/usr/bin/env node
'use strict';
// Read-only static handoff audit, no fetch, Firebase, Supabase, or WhatsApp calls.
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const cases=[
 ['Gate tracking protegido','lib/tracking/gate1/core.ts','mayIssueNewTrackingGrant'],
 ['Emissao manual reservada','lib/tracking/manualTrackingAuto.ts','tracking_manual_auto_handoffs_v1'],
 ['Mensageria opt-in','lib/integration/server/manualMessaging.ts','manual_messaging_opt_in_v1'],
 ['Primeira parada','lib/integration/server/manualMessaging.ts','manualFirstStopContext'],
 ['Proxima parada','lib/integration/server/manualNextStop.ts','manual_messaging_opt_in_v1'],
 ['Acompanhamento privado','app/mais/acompanhamento/page.tsx','issue_tracking_link'],
 ['Retornos e reentregas','app/entregas/retornos/page.tsx','isAwaitingRedelivery'],
 ['Central Comunicacao 360','app/mais/comunicacao/page.tsx','Acompanhamento protegido'],
 ['Inteligencia 360','app/mais/inteligencia/page.tsx','r73IntelligencePulse'],
];
for(const [name,path,anchor] of cases){assert.ok(read(path).includes(anchor),`${name}: contrato ausente`);console.log('OK: '+name);}
console.log('R73 AUDITORIA LOCAL: 9 referencias presentes; flags, producao e entrega real do WhatsApp NAO CERTIFICADAS.');
