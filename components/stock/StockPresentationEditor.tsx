'use client';

import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import type { StockProductPresentation, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { parseStockQuantityInput } from '@/lib/stock-quantity';
import { humanPresentation } from '@/lib/stock-commercial-display-v2';

const field='h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-emerald-500';

const MASS:StockSupplyUnit[]=['g','kg'];
const VOLUME:StockSupplyUnit[]=['ml','l'];

const compatible=(base:StockSupplyUnit):StockSupplyUnit[]=>
 MASS.includes(base)?MASS:
 VOLUME.includes(base)?VOLUME:
 base==='un'?['un']:
 base==='pct'?['pct']:
 base==='cx'?['cx']:
 base==='fardo'?['fardo']:
 [base];

const toBase=(value:number,from:StockSupplyUnit,to:StockSupplyUnit)=>{
 if(from===to)return value;
 if(from==='g'&&to==='kg')return value/1000;
 if(from==='kg'&&to==='g')return value*1000;
 if(from==='ml'&&to==='l')return value/1000;
 if(from==='l'&&to==='ml')return value*1000;
 return value;
};

const bestInputUnit=(base:StockSupplyUnit,baseValue:number):StockSupplyUnit=>{
 if(base==='kg'&&baseValue>0&&baseValue<1)return'g';
 if(base==='l'&&baseValue>0&&baseValue<1)return'ml';
 return base;
};

const singular=(unit:StockSupplyUnit)=>{
 const map:Record<StockSupplyUnit,string>={
  un:'unidade',kg:'kg',g:'g',l:'L',ml:'ml',
  cx:'caixa',pct:'pacote',fardo:'fardo'
 };
 return map[unit];
};

const plural=(unit:StockSupplyUnit,value:number)=>{
 if(value===1)return singular(unit);
 const map:Partial<Record<StockSupplyUnit,string>>={
  un:'unidades',cx:'caixas',pct:'pacotes',fardo:'fardos'
 };
 return map[unit]||singular(unit);
};

const purchaseName=(unit:StockSupplyUnit)=>{
 const map:Record<StockSupplyUnit,string>={
  un:'Unidade',kg:'Quilo',g:'Grama',l:'Litro',ml:'Mililitro',
  cx:'Caixa',pct:'Pacote',fardo:'Fardo'
 };
 return map[unit];
};

const number=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:4});

const suggestedLabel=(purchase:StockSupplyUnit,conversion:number,base:StockSupplyUnit)=>{
 const q=Math.max(0,Number(conversion)||0);
 if(!q)return purchaseName(purchase);
 if(purchase===base&&Math.abs(q-1)<1e-9)return purchaseName(purchase);
 if(purchase==='cx')return `Caixa com ${number(q)} ${plural(base,q)}`;
 if(purchase==='pct')return `Pacote com ${number(q)} ${plural(base,q)}`;
 if(purchase==='fardo')return `Fardo com ${number(q)} ${plural(base,q)}`;
 if(purchase==='un'&&base==='un')return q===1?'Unidade':`Unidade com ${number(q)} unidades`;
 return `${purchaseName(purchase)} de ${number(q)} ${plural(base,q)}`;
};

export function StockPresentationEditor({
 baseUnit,value,onChange
}:{
 baseUnit:StockSupplyUnit;
 value:StockProductPresentation[];
 onChange:(v:StockProductPresentation[])=>void
}){
 const add=()=>onChange([
  ...value,
  {
   id:`presentation-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
   label:'',
   purchase_unit:baseUnit==='un'?'pct':baseUnit,
   conversion_quantity:1,
   active:true
  }
 ]);

 const patch=(id:string,data:Partial<StockProductPresentation>)=>
  onChange(value.map(x=>x.id===id?{...x,...data}:x));

 return <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
  <div className="flex items-start justify-between gap-3">
   <div>
    <p className="flex items-center gap-2 text-sm font-black text-zinc-100">
     <PackagePlus size={16} className="text-emerald-400"/>
     Como você compra este produto?
    </p>
    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
     Cadastre cada forma vendida pelo fornecedor. O estoque continua sendo controlado em <b className="text-zinc-300">{SUPPLY_UNIT_LABELS[baseUnit].toLocaleLowerCase('pt-BR')}</b>.
    </p>
   </div>

   <button type="button" onClick={add} className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400">
    <Plus size={13}/>Adicionar
   </button>
  </div>

  {!value.length&&
   <p className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3 text-[10px] text-zinc-600">
    Nenhuma apresentação cadastrada. Ex.: Pacote com 100 unidades, Caixa com 12 unidades ou Fardo com 6 unidades.
   </p>
  }

  <div className="mt-3 space-y-3">
   {value.map(item=>{
    const inputUnit=bestInputUnit(baseUnit,item.conversion_quantity);
    const shown=toBase(item.conversion_quantity,baseUnit,inputUnit);
    const valid=item.label.trim()&&Number.isFinite(Number(item.conversion_quantity))&&Number(item.conversion_quantity)>0;
    const suggestion=suggestedLabel(item.purchase_unit,item.conversion_quantity,baseUnit);

    const updateConversion=(raw:string,unit:StockSupplyUnit)=>{
     const n=Math.max(0,parseStockQuantityInput(raw));
     const converted=Math.max(.0001,toBase(n,unit,baseUnit));
     patch(item.id,{conversion_quantity:converted});
    };

    return <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3">

     <div className="grid grid-cols-[1fr_44px] gap-2">
      <label className="text-[9px] font-bold text-zinc-500">
       Nome da apresentação
       <input
        value={item.label}
        onChange={e=>patch(item.id,{label:e.target.value})}
        placeholder={suggestion}
        className={`${field} mt-1`}
       />
      </label>

      <button
       type="button"
       onClick={()=>onChange(value.filter(x=>x.id!==item.id))}
       className="mt-[17px] grid h-11 w-11 place-items-center rounded-xl bg-red-500/10 text-red-400"
       aria-label={`Remover ${item.label||'apresentação'}`}
      >
       <Trash2 size={15}/>
      </button>
     </div>

     {!item.label.trim()&&
      <button
       type="button"
       onClick={()=>patch(item.id,{label:suggestion})}
       className="mt-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-left text-[9px] font-bold text-zinc-400"
      >
       Usar sugestão: <b className="text-emerald-400">{suggestion}</b>
      </button>
     }

     <div className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <label className="text-[9px] font-bold text-zinc-500">
       Fornecedor vende por
       <select
        value={item.purchase_unit}
        onChange={e=>{
         const next=e.target.value as StockSupplyUnit;
         patch(item.id,{purchase_unit:next});
        }}
        className={`${field} mt-1`}
       >
        {Object.entries(SUPPLY_UNIT_LABELS).map(([k,l])=>
         <option key={k} value={k}>{l}</option>
        )}
       </select>
      </label>

      <div>
       <p className="text-[9px] font-bold text-zinc-500">
        Cada {singular(item.purchase_unit)} contém
       </p>

       <div className="mt-1 grid grid-cols-[1fr_92px] gap-1">
        <input
         key={`${item.id}-${inputUnit}`}
         inputMode="decimal"
         defaultValue={String(shown).replace('.',',')}
         onBlur={e=>updateConversion(e.target.value,inputUnit)}
         className={field}
        />

        <select
         value={inputUnit}
         onChange={e=>{
          const next=e.target.value as StockSupplyUnit;
          const input=e.currentTarget.previousElementSibling as HTMLInputElement|null;
          const current=Math.max(0,parseStockQuantityInput(input?.value||'0'));
          const oldBase=toBase(current,inputUnit,baseUnit);
          const nextShown=toBase(oldBase,baseUnit,next);
          if(input)input.value=String(nextShown).replace('.',',');
         }}
         className={field}
        >
         {compatible(baseUnit).map(u=>
          <option key={u} value={u}>
           {plural(u,shown)}
          </option>
         )}
        </select>
       </div>
      </div>
     </div>

     {!valid
      ? <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[.06] px-3 py-2 text-[9px] font-bold leading-relaxed text-red-300">
         Forma de compra incompleta. Informe um nome e quanto existe dentro de cada embalagem.
        </p>
      : <div className="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[.045] px-3 py-2.5">
         <p className="text-[9px] font-black uppercase tracking-wide text-emerald-400">
          Como o app vai entender
         </p>
         <p className="mt-1 text-[11px] font-bold text-zinc-200">
          1 {singular(item.purchase_unit)} = {number(item.conversion_quantity)} {plural(baseUnit,item.conversion_quantity)}
         </p>
         <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">
          Aparece como <b className="text-zinc-300">{humanPresentation(item,baseUnit)}</b>. Ao movimentar 1 {singular(item.purchase_unit)}, o estoque muda {number(item.conversion_quantity)} {plural(baseUnit,item.conversion_quantity)}.
         </p>
        </div>
     }

     <label className="mt-3 flex items-center gap-2 text-[9px] font-bold text-zinc-500">
      <input
       type="checkbox"
       checked={item.active}
       onChange={e=>patch(item.id,{active:e.target.checked})}
       className="accent-emerald-500"
      />
      Ativa para novas compras e movimentações
     </label>
    </div>
   })}
  </div>
 </section>;
}
