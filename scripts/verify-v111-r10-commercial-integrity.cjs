const fs=require('fs');const assert=require('assert');
const file=p=>fs.readFileSync(p,'utf8');
const editor=file('components/stock/StockPresentationEditor.tsx');
const fresh=file('app/estoque/novo/page.tsx');
const edit=file('app/estoque/editar/page.tsx');
const integrity=file('lib/stock-presentation-integrity.ts');
for(const [label,condition] of [
 ['cadastro não descarta embalagem',fresh.includes('cleanCommercialPresentations(presentations)')&&!fresh.includes('presentations.filter(')],
 ['edição não descarta embalagem',edit.includes('cleanCommercialPresentations(presentations)')&&!edit.includes('presentations.filter(')],
 ['validação em ambos os formulários',fresh.includes('validateCommercialPresentations(presentations)')&&edit.includes('validateCommercialPresentations(presentations)')],
 ['nova apresentação pede preenchimento',editor.includes('conversion_quantity:0,active:true')],
 ['conversão não inventa valor positivo',!editor.includes('Math.max(.0001,toBase(')],
 ['entradas pausadas preservadas',integrity.includes('if (!item.active) continue')],
 ['limite contra valores não finitos',integrity.includes('Number.isFinite(conversion)')],
 ['alerta acessível',editor.includes('role="alert"')],
]) { assert(condition,label); console.log('OK: '+label); }
