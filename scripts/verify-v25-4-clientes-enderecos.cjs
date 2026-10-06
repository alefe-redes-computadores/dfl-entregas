const fs=require('fs');
const read=(p)=>fs.readFileSync(p,'utf8');
const ok=(c,m)=>{if(!c)throw new Error('V25.4: '+m);console.log('OK:',m)};

const customer=read('components/deliveries/CustomerAutocomplete.tsx');
const address=read('lib/address-autocomplete.ts');
const nova=read('app/entregas/nova/page.tsx');
const canonical=read('lib/operational-address.ts');

ok(customer.includes('const openSuggestions = () =>'), 'seletor de cliente abre imediatamente');
ok(!customer.includes('openTimerRef')&&!customer.includes('closeTimerRef'), 'seletor não se auto-fecha por timer');
ok(customer.includes('onFocus={openSuggestions}'), 'foco mantém pesquisa disponível');
ok(customer.includes('onChange(event.target.value);')&&customer.includes('openSuggestions();'), 'digitação continua livre com sugestões abertas');
ok(customer.includes("document.addEventListener(")&&customer.includes("'mousedown'"), 'clique externo continua fechando sugestões');
ok(customer.includes('onClick={closeSuggestions}'), 'novo cliente pode fechar sugestões explicitamente');

ok(address.includes('SUGGESTION_CACHE_MS = 10 * 60 * 1000'), 'cache Geoapify de 10 minutos preservado');
ok(address.includes('`${query}, Patos de Minas, MG`'), 'consulta Geoapify recebe contexto explícito de Patos');
ok(address.includes('filter: `rect:${PATOS_BOUNDS.lon1}'), 'limite geográfico de Patos preservado');
ok(address.includes('bias: `proximity:${PATOS_CENTER.longitude}'), 'ranking por proximidade preservado');
ok(address.includes('canonicalizeOperationalAddress('), 'resultado selecionado passa pela autoridade canônica');
ok(canonical.includes(".replace(/,?\\s*Brasil\\b/gi, ' ')")&&canonical.includes(".replace(/,?\\s*Brazil\\b/gi, ' ')"), 'Brasil/Brazil continuam removidos');
ok(canonical.includes('const POSTAL ='), 'CEP continua tratado como domínio independente');
ok(nova.includes('onChange={(e) => setPhone(formatPhoneInput(e.target.value))}'), 'telefone permanece editável');
ok(nova.includes('onChange={setStreetAddress}'), 'endereço manual permanece editável');
ok(nova.includes("canonicalizeOperationalAddress(streetAddress)"), 'salvamento mantém canonicalização final');

console.log('V25.4 CLIENTES + ENDEREÇOS: CONTRATOS OK');
