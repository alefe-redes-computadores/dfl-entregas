const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const settle=read('app/motoboys/acerto/page.tsx'),supplier=read('components/stock-supplies/StockSupplierPicker.tsx'),queue=read('components/store/OperationalAttentionQueue.tsx');
for(const token of ["aria-pressed={cashMode===value}","disabled={saving||Boolean(existing)} onClick={()=>{setCashMode(value);","disabled={saving||Boolean(existing)} onChange={e=>setCashHandedDraft"])assert(settle.includes(token),'Acerto manual sem trava: '+token);
for(const token of ['disabled={saving} aria-pressed={value===s.id}','if(saving)return;onChange(s.id,s.name)','setName(query.trim());setCreating(true)','disabled={saving} aria-pressed={type===key}'])assert(supplier.includes(token),'Fornecedor: '+token);
for(const token of ['replace(/^#(?=','const compactOrder=task.orderRef.replace(', 'aria-live="polite"'])assert(queue.includes(token),'Fila: '+token);
console.log('V96 — Acerto, fornecedores e busca operacional: contratos aprovados');
