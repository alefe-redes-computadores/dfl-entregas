#!/usr/bin/env node
'use strict';
const fs=require('fs');const assert=require('assert/strict');
const geo=fs.readFileSync('lib/store-geocoding.ts','utf8');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
const staff=fs.readFileSync('lib/access/staffRepository.ts','utf8');
const roles=fs.readFileSync('lib/access/roles.ts','utf8');
let n=0;const ok=(x,msg)=>{assert.ok(x,msg);n++;};
ok(geo.includes('mapsLoader = null;')&&geo.includes('Falha ao carregar o serviço do Google Maps.'),'Google Maps tem retry apos falha');
ok(geo.includes('GEO_CACHE_TTL_MS')&&geo.includes('pendingGeocodes'),'Cache e deduplicacao E2 preservados');
ok(geo.includes('GEO_CACHE_MAX_ENTRIES'),'Limite de memoria preservado');
ok(staff.includes("record.activation !== 'not_enabled'"),'Convite nao ativa login');
ok(roles.includes("activation: 'not_enabled'"),'Tipos nao autorizam staff');
for(const file of ['scripts/test-r125-staff-safety.cjs','scripts/test-r125-geocode-cache.cjs','scripts/test-r125-e3-resilience.cjs']){ok(fs.existsSync(file),file+' existe');ok(pre.includes("'"+file+"'"),file+' esta no pre-apk');}
const all=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);ok(all.length>150,'pre-apk amplo mantido');ok(all.length===new Set(all).size,'pre-apk nao duplica testes');
console.log('R125 E3:',n,'contratos aprovados');
