import type { StockProduct, StockProductPresentation, StockSupplyUnit } from '@/types';
import { formatStockQuantity } from '@/lib/stock-quantity';

const unitWord=(unit:StockSupplyUnit,q:number)=>{
  const one:Record<StockSupplyUnit,string>={un:'unidade',kg:'kg',g:'g',l:'L',ml:'ml',cx:'caixa',pct:'pacote',fardo:'fardo'};
  const many:Partial<Record<StockSupplyUnit,string>>={un:'unidades',cx:'caixas',pct:'pacotes',fardo:'fardos'};
  return q===1?one[unit]:(many[unit]||one[unit]);
};
const number=(q:number,max=3)=>q.toLocaleString('pt-BR',{maximumFractionDigits:max});

export function cleanPresentationLabel(label:string){
  return label.replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');
}

export function humanPresentation(p:StockProductPresentation,baseUnit:StockSupplyUnit){
  const q=Math.max(0,Number(p.conversion_quantity)||0);
  const label=cleanPresentationLabel(p.label||'');
  if(label){
    const normalized=label.toLocaleLowerCase('pt-BR');
    // Evita "pacote de Unidade - 300g" e similares: rótulo humano ganha prioridade.
    if(!/^(unidade|quilo|grama|litro|mililitro)$/i.test(label)) return label;
  }
  if(p.purchase_unit==='pct') return q?`pacote de ${formatStockQuantity(q,baseUnit)}`:'pacote';
  if(p.purchase_unit==='cx') return q?`caixa com ${formatStockQuantity(q,baseUnit)}`:'caixa';
  if(p.purchase_unit==='fardo') return q?`fardo com ${formatStockQuantity(q,baseUnit)}`:'fardo';
  if(p.purchase_unit==='un' && baseUnit==='un') return q===1?'unidade':`unidade com ${number(q)} un`;
  return `${unitWord(p.purchase_unit,1)} de ${formatStockQuantity(q,baseUnit)}`;
}

export function humanPurchasePlan(args:{purchaseQuantity:number;baseQuantity:number;baseUnit:StockSupplyUnit;presentation?:StockProductPresentation}){
  const {purchaseQuantity:q,baseQuantity,baseUnit,presentation:p}=args;
  if(!p) return formatStockQuantity(baseQuantity,baseUnit);
  const presentation=humanPresentation(p,baseUnit);
  if(q===1) return `1 ${presentation}`;
  const noun=p.purchase_unit==='pct'?'pacotes':p.purchase_unit==='cx'?'caixas':p.purchase_unit==='fardo'?'fardos':p.purchase_unit==='un'?'unidades':unitWord(p.purchase_unit,q);
  // Se o rótulo começa pelo mesmo substantivo, não repete "unidades de Unidade".
  const detail=presentation.replace(/^(pacote|caixa|fardo|unidade)s?\s*/i,'').trim();
  const head=`${number(q)} ${noun}`;
  if(!detail) return head;
  return `${head} ${detail.startsWith('de ')||detail.startsWith('com ')?detail:`de ${detail}`}`;
}

export function physicalStockDisplay(product:StockProduct){
  const current=Math.max(0,Number(product.current_quantity)||0);
  // Caso clássico: estoque legado em pacote fracionado, apresentação informa quantas unidades existem no pacote.
  // Só converte visualmente quando a unidade-base é pacote e existe apresentação ativa em unidade.
  if(product.unit==='pct'){
    const p=(product.presentations||[]).find(x=>x.active&&x.purchase_unit==='un'&&Number(x.conversion_quantity)>0);
    if(p){
      const physical=current*Number(p.conversion_quantity);
      if(Math.abs(physical-Math.round(physical))<0.0001) return {primary:`${Math.round(physical)} ${Math.round(physical)===1?'un':'un'}`,secondary:`${number(current)} pct`};
    }
  }
  return {primary:formatStockQuantity(current,product.unit),secondary:null as string|null};
}

export function naturalStockNameKey(name:string){
  const s=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const size=(s.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg)\b/)||[]).slice(1).join('');
  const base=s.replace(/\b\d+(?:[.,]\d+)?\s*(ml|l|g|kg)\b/g,'').replace(/\bzero\b/g,'').replace(/\s+/g,' ').trim();
  const packageRank=/lata/.test(s)?'0':/garrafa/.test(s)?'1':'2';
  const zero=/\bzero\b/.test(s)?'1':'0';
  return `${base}|${packageRank}|${zero}|${size}|${s}`;
}
export function naturalStockNameCompare(a:string,b:string){
  return naturalStockNameKey(a).localeCompare(naturalStockNameKey(b),'pt-BR',{numeric:true,sensitivity:'base'});
}
