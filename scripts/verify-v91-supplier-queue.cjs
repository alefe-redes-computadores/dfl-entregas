const fs=require('fs'),assert=require('assert');const s=fs.readFileSync('components/stock-supplies/StockSupplierPicker.tsx','utf8'),q=fs.readFileSync('components/store/OperationalAttentionQueue.tsx','utf8');
assert(s.includes('if(saving)return')&&s.includes('await add(item);onChange(item.id,item.name)'));
assert(s.includes('normalize(x.name)===normalize(clean)')&&s.includes('Fornecedor existente selecionado'));
assert(s.includes('aria-busy={saving}')&&s.includes('aria-modal="true"'));
assert(q.includes('visible.slice(0,8)')&&q.includes('shown.map(task=>'));
assert(q.includes('Mostrar todas as ${visible.length} ações')&&q.includes('setShowAll(false)'));
console.log('V91: fornecedor persistido antes de selecionar, deduplicação e fila mobile OK');
