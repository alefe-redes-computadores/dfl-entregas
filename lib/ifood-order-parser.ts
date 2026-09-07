// lib/ifood-order-parser.ts
import type { Delivery } from '@/types';

export interface ParsedIfoodOrder {
  orderId: string; ifoodId: string; confirmationCode: string; customerName: string;
  phone: string; address: string; mapsLink: string; isPaid: boolean;
  paymentMethod: Delivery['payment_method'] | null; value: string; changeFor: string;
  drinks: string[]; observations: string[];
}

const STREET = /(?:\br\.(?=\s)|\b(?:rua|av\.?|avenida|alameda|travessa|pra[cç]a|rodovia|estrada|beco|viela)\b)/i;
const URL = /https?:\/\/[^\s<>()]+/gi;
const MAP_HOST = /(?:google\.[^/]+\/(?:maps|url)|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
const OBS_PREFIX = /^(?:obs(?:erva(?:ç|c)[aã]o)?|refer[eê]ncia|complemento|instru(?:ç|c)[aã]o|port[aã]o)\s*:\s*/i;
const INSTRUCTION = /\b(?:ap(?:to|artamento)?\.?|bloco|casa|fundos|andar|sala|lote|quadra|port[aã]o|interfone|ligar|chamar|entrada|esquina|em frente|ao lado|casa de|deixar|tocar|buzinar)\b/i;
const NEIGHBORHOOD = /^(?:bairro\s+)?(?:vila|jardim|jd\.?|residencial|loteamento|condom[ií]nio|centro|distrito|ch[aá]cara|morada|nova|novo|santa|santo|s[ãa]o)\b/i;

const emptyResult = (): ParsedIfoodOrder => ({ orderId:'',ifoodId:'',confirmationCode:'',customerName:'',phone:'',address:'',mapsLink:'',isPaid:false,paymentMethod:null,value:'',changeFor:'',drinks:[],observations:[] });
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
  let line=source.replace(URL,' ')
    .replace(/\bCEP\s*:?\s*\d{5}-?\d{3}\b/gi,' ')
    .replace(/,?\s*Patos de Minas\s*(?:[-/,]\s*MG)?\b/gi,' ')
    .replace(/,?\s*Minas Gerais\b/gi,' ')
    .replace(/,?\s*MG\b/gi,' ')
    .replace(/,?\s*Brasil\b/gi,' ')
    .replace(/(\b\d+)\s*-\s*([A-Za-z]\b)/g,'$1$2')
    .replace(/\s*[,;]\s*/g,' - ').replace(/\s*[-–—]\s*/g,' - ')
    .replace(/(?:\s+-\s+){2,}/g,' - ');
  const parts=line.split(/\s+-\s+/).map(spaces).filter(Boolean);
  if(!parts.length)return '';
  let street=parts.shift()!; let number='';
  const inline=street.match(/^(.*?)[,\s]+(\d+[A-Za-z]?|s\/?n)$/i);
  if(inline){street=inline[1];number=inline[2];}
  else if(parts[0]&&/^(?:\d+[A-Za-z]?|s\/?n)$/i.test(parts[0]))number=parts.shift()!;
  let neighborhood='';
  for(const part of parts){
    if(INSTRUCTION.test(part)&&!NEIGHBORHOOD.test(part))addUnique(observations,part);
    else if(!neighborhood&&!/^(?:casa|resid[eê]ncia)$/i.test(part))neighborhood=part.replace(/^bairro\s+/i,'');
    else if(part)addUnique(observations,part);
  }
  return spaces(`${street.replace(/[,]$/,'')}${number?`, ${number}`:''}${neighborhood?` - ${neighborhood}`:''}`).replace(/[,\-]\s*$/,'');
}

function parsePayment(line:string,result:ParsedIfoodOrder){
  if(/\b(?:pago\s+(?:no\s+app|online)|pedido\s+pago|pagamento\s+online)\b/i.test(line)&&!/\bn[aã]o\s+pago\b/i.test(line)){result.paymentMethod='pix';result.isPaid=true;result.changeFor='';return;}
  if(/\b(?:cart[aã]o|cr[eé]dito|d[eé]bito)\b/i.test(line)){result.paymentMethod='cartao';result.isPaid=false;result.changeFor='';}
  else if(/\b(?:dinheiro|troco|voltar)\b/i.test(line)){result.paymentMethod='dinheiro';result.isPaid=false;}
  else if(/\bpix\b/i.test(line))result.paymentMethod='pix';
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
    parsePayment(line,result);parseFinancial(line,result);
    if(STREET.test(line)||/\bCEP\s*:?\s*\d{5}-?\d{3}\b/i.test(line)){result.address=cleanAddress(original,result.observations);return;}
    if(OBS_PREFIX.test(line)){addUnique(result.observations,line.replace(OBS_PREFIX,''));return;}
    if(INSTRUCTION.test(line)&&!/(?:pagamento|dinheiro|troco|cart[aã]o|pix)/i.test(line))addUnique(result.observations,line);
  });return result;
}
