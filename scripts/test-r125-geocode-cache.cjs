#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('lib/store-geocoding.ts','utf8');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
function check(ok,msg){assert.ok(ok,msg);console.log('OK:',msg)}
check(source.includes('GEO_CACHE_TTL_MS = 10 * 60 * 1000'), 'TTL do cache geográfico 10 minutos');
check(source.includes('GEO_CACHE_MAX_ENTRIES = 80'), 'cache limitado a 80 entradas');
check(source.includes('const pendingGeocodes = new Map<string, Promise<LatLngPoint>>()'), 'buscas idênticas simultâneas coalescidas');
check(source.includes('pendingGeocodes.get(key)'), 'consulta busca pendente antes da API');
check(source.includes('pendingGeocodes.delete(key)'), 'remoção de pendência após sucesso ou falha');
check(source.includes('expiresAt > Date.now()'), 'cache expirado não reutilizado');
check(source.includes('if (addressCache.size > GEO_CACHE_MAX_ENTRIES)'), 'limite de memória aplicado');
check(source.includes('if (inPatosBounds(point))'), 'coordenadas geográficas continuam restritas a Patos');
check(source.includes('geocodeWithGoogle(query)'), 'fallback Google preservado');
check(source.includes('geocodeWithGeoapify(query)'), 'Geoapify preservada');
check(pre.includes("'scripts/test-r125-geocode-cache.cjs'"), 'gate cadastrado no pre-APK');
check(pre.includes("'scripts/test-r125-staff-safety.cjs'"), 'R125 etapa 1 preservada');
console.log('R125 E2: contratos de cache e compatibilidade OK');
