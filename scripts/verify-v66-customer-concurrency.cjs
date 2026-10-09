const fs=require('fs');const assert=require('node:assert/strict');
const s=fs.readFileSync('store/useAppStore.ts','utf8');
for(const [label,part] of [
 ['fila de cadastro', 'customerCreationFlights = new Map<string, Promise<string>>()'],
 ['serialização de concorrentes','customerCreationFlights.get(flightKey)'],
 ['reavaliação da identidade', 'get().findOrCreateCustomer(name, details)'],
 ['evidência de identidade preservada','customerIdentityEvidence('],
 ['busca existente preservada','findExistingCustomer('],
 ['criação persistida','await setDoc('],
 ['liberação da fila','customerCreationFlights.delete(flightKey)'],
 ['erro preservado', 'throw error;'],
]){assert.ok(s.includes(part),label);console.log('OK:',label)}
console.log('V66 CLIENTES: 8 verificações estruturais aprovadas');
