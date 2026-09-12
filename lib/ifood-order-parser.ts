// lib/ifood-order-parser.ts
import type { Delivery } from '@/types';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';

export interface ParsedIfoodOrder {
  orderId: string; ifoodId: string; confirmationCode: string; customerName: string;
  phone: string; address: string; mapsLink: string; isPaid: boolean;
  paymentMethod: Delivery['payment_method'] | null; value: string; changeFor: string;
  drinks: string[]; observations: string[];
  routeNumber: string; motoboyHint: string;
}

const STREET = /(?:\br\.(?=\s)|\b(?:rua|av\.?|avenida|alameda|travessa|pra[cç]a|rodovia|estrada|beco|viela)\b)/i;
const URL = /https?:\/\/[^\s<>()]+/gi;
const MAP_HOST = /(?:google\.[^/]+\/(?:maps|url)|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
const OBS_PREFIX = /^(?:obs(?:erva(?:ç|c)[aã]o)?|refer[eê]ncia|complemento|instru(?:ç|c)[aã]o|port[aã]o)\s*:\s*/i;
const INSTRUCTION = /\b(?:ap(?:to|artamento)?\.?|bloco|casa|fundos|andar|sala|lote|quadra|port[aã]o|interfone|ligar|chamar|entrada|esquina|em frente|ao lado|casa de|deixar|tocar|buzinar)\b/i;
const NEIGHBORHOOD = /^(?:bairro\s+)?(?:vila|jardim|jd\.?|residencial|loteamento|condom[ií]nio|centro|distrito|ch[aá]cara|morada|nova|novo|santa|santo|s[ãa]o)\b/i;

const emptyResult = (): ParsedIfoodOrder => ({ orderId:'',ifoodId:'',confirmationCode:'',customerName:'',phone:'',address:'',mapsLink:'',isPaid:false,paymentMethod:null,value:'',changeFor:'',drinks:[],observations:[],routeNumber:'',motoboyHint:'' });
const spaces = (value:string) => value.replace(/\s+/g,' ').replace(/\s+,/g,',').trim();
const numberValue = (value:string) => { const clean=value.replace(/\s/g,''); return Number(clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean); };
const currency = (value:number) => value.toFixed(2).replace('.',',');

function addUnique(target:string[], value:string) {
  const clean=spaces(value).replace(/^[-–—,;]+|[-–—,;]+$/g,'').trim();
  const key=clean.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(clean&&!target.some(item=>item.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===key)) target.push(clean);
}

function mapUrl(line:string) {
  return (line.match(URL)??[]).find(value=>MAP_HOST.test(value))?.replace(/[),.;]+$/,'')??'';
}

function cleanAddress(source:string, observations:string[]) {
  const normalized = canonicalizeOperationalAddress(source);

  normalized.observations.forEach((item) =>
    addUnique(observations, item)
  );

  return normalized.address;
}

function parsePayment(line:string,result:ParsedIfoodOrder){
  const negative=/\b(?:n[aã]o\s+pago|n[aã]o\s+foi\s+pago|pagamento\s+pendente|pix\s+pendente|pagar\s+na\s+entrega)\b/i.test(line);
  const cash=/\b(?:dinheiro|troco|voltar)\b/i.test(line);
  const card=/\b(?:cart[aã]o|cr[eé]dito|d[eé]bito|maquininha)\b/i.test(line);
  const paidSignal=!negative&&!cash&&!card&&(/\b(?:pago|paga|pagamento\s+(?:online|pago|confirmado|aprovado|ok)|pedido\s+pago|j[aá]\s+pago|pago\s+(?:no\s+app|online)|pix\s+(?:pago|confirmado|aprovado|ok))\b/i.test(line)||/^\s*(?:pago|confirmado)\s*[!✅.]*\s*$/i.test(line));
  if(card){result.paymentMethod='cartao';result.isPaid=false;result.changeFor='';return;}
  if(cash){result.paymentMethod='dinheiro';result.isPaid=false;return;}
  if(paidSignal){result.paymentMethod='pix';result.isPaid=true;result.changeFor='';return;}
  if(/\bpix\b/i.test(line)){result.paymentMethod='pix';result.isPaid=!negative&&/\b(?:pago|confirmado|aprovado|ok|online)\b/i.test(line);if(result.isPaid)result.changeFor='';}
}

function parseRouteHint(line:string,result:ParsedIfoodOrder){
  const routeMatch=line.match(/\brota\s*(?:n[ºo°.]?\s*)?(\d{1,2})\b/i);
  if(routeMatch)result.routeNumber||=routeMatch[1];

  let hint='';
  if(routeMatch){
    const before=line.slice(0,routeMatch.index??0).replace(/[-–—:|]+$/g,'').trim();
    const after=line.slice((routeMatch.index??0)+routeMatch[0].length).replace(/^[-–—:|]+/g,'').trim();

    const cleanCandidate=(value:string)=>value
      .replace(/\b(?:motoboy|entregador|com|vai\s+com)\b/gi,' ')
      .replace(/\s+/g,' ')
      .trim();

    const afterCandidate=cleanCandidate(after);
    const beforeCandidate=cleanCandidate(before);

    if(afterCandidate&&/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40}$/.test(afterCandidate))hint=afterCandidate;
    else if(beforeCandidate&&/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40}$/.test(beforeCandidate))hint=beforeCandidate;
  }

  const explicit=line.match(/\b(?:motoboy|entregador)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40})$/i);
  if(explicit)hint=explicit[1].trim();

  if(hint)result.motoboyHint||=spaces(hint);
}

function parseFinancial(line:string,result:ParsedIfoodOrder){
  const tokens=[...line.matchAll(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi)].map(match=>({value:numberValue(match[1]),index:match.index??0}));
  const changeIndex=line.search(/\b(?:troco|voltar)\b/i);
  const baseToken=tokens.find(token=>changeIndex<0||token.index<changeIndex);
  if(!result.value&&/\b(?:valor|total|pagamento|pago|pix|cart[aã]o|dinheiro|troco|voltar)\b/i.test(line)&&baseToken&&Number.isFinite(baseToken.value))result.value=currency(baseToken.value);
  const base=result.value?numberValue(result.value):baseToken?.value;
  const tendered=line.match(/\btroco\s+(?:para|p\/?|de)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const returned=line.match(/\b(?:troco|voltar)\s*(?!para\b|p\/?\b|de\b)(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i)||line.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+de\s+troco\b/i);
  if(tendered){const value=numberValue(tendered[1]);if(Number.isFinite(value))result.changeFor=currency(value);}
  else if(returned&&Number.isFinite(base)){const value=numberValue(returned[1]);if(Number.isFinite(value))result.changeFor=currency((base as number)+value);}
}

export function parseIfoodOrderText(text:string):ParsedIfoodOrder{
  const result=emptyResult(); const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean); let idLine=-1;
  lines.forEach((line,index)=>{const url=mapUrl(line);if(url)result.mapsLink=url;const tokens=line.replace(/\D+/g,' ').trim().split(' ').filter(Boolean);if(!tokens.length||STREET.test(line)||/\b(?:cep|total)\b|r\$/i.test(line)||!tokens.some(token=>token.length===8))return;idLine=index;result.ifoodId||=tokens.find(token=>token.length===8)??'';const short=tokens.filter(token=>token.length===4||token.length===5);result.orderId||=short[0]??'';result.confirmationCode||=short.find(token=>token.length===4&&token!==result.orderId)??'';});
  lines.forEach((original,index)=>{const line=spaces(original.replace(URL,' '));if(index===idLine||!line)return;
    if(/^(?:cliente|nome)\s*:/i.test(line)){result.customerName=line.replace(/^(?:cliente|nome)\s*:\s*/i,'').trim();return;}
    if(!result.customerName&&idLine>=0&&index>idLine&&index<=idLine+2&&!STREET.test(line)&&!/(?:cep|pago|cart[aã]o|dinheiro|pix|total)/i.test(line)&&!/\d+[.,]\d{2}/.test(line)){result.customerName=line.replace(/^[-•*]\s*/,'').trim();return;}
    const phone=line.match(/(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/)?.[0];if(phone&&!result.phone&&!/cep/i.test(line)){const digits=phone.replace(/\D/g,'');if(digits.length>=10&&digits.length<=11)result.phone=digits;}
    const drink=/(coca|guaran[aá]|fanta|sprite|suco|refrigerante|cerveja|heineken|[aá]gua|schweppes|del valle)/i.test(line);const volume=/(\d+\s*(?:l|ml|litro|litros)|lata|garrafa)/i.test(line);if(drink||(volume&&!STREET.test(line)&&! /\bap(?:to)?\b/i.test(line))){addUnique(result.drinks,line.replace(/^[-•*x\d\s]+\s*/i,''));return;}
    parseRouteHint(line,result);parsePayment(line,result);parseFinancial(line,result);
    if(result.routeNumber&&/\brota\b/i.test(line))return;
    if(STREET.test(line)||/\bCEP\s*:?\s*\d{5}-?\d{3}\b/i.test(line)){result.address=cleanAddress(original,result.observations);return;}
    if(OBS_PREFIX.test(line)){addUnique(result.observations,line.replace(OBS_PREFIX,''));return;}
    if(INSTRUCTION.test(line)&&!/(?:pagamento|dinheiro|troco|cart[aã]o|pix)/i.test(line))addUnique(result.observations,line);
  });return result;
}
