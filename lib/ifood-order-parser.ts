import type { Delivery } from '../types';

export interface ParsedIfoodOrder {
  orderId: string;
  ifoodId: string;
  confirmationCode: string;
  customerName: string;
  phone: string;
  address: string;
  mapsLink: string;
  isPaid: boolean;
  paymentMethod: Delivery['payment_method'] | null;
  value: string;
  changeFor: string;
  drinks: string[];
  observations: string[];
}

const STREET_PATTERN = /(?:\br\.(?=\s)|\b(?:rua|av\.?|avenida|alameda|travessa|praça|praca|rodovia|estrada|beco|viela)\b)/i;
const NEIGHBORHOOD_HINT = /\b(?:bairro|vila|jardim|jd\.?|residencial|loteamento|condom[ií]nio|centro|distrito|ch[aá]cara|morada|nova|novo|santa|santo|s[ãa]o)\b/i;
const COMPLEMENT_PATTERN = /\b(?:ap(?:to|artamento)?\.?|bloco|casa|fundos|andar|sala|lote|quadra)\s*[A-Za-zÀ-ÿ0-9.]+(?:\s+[A-Za-zÀ-ÿ0-9.]+)?/gi;
const OBSERVATION_PREFIX = /^(?:obs(?:erva(?:ç|c)[aã]o)?|refer[eê]ncia|complemento|instru(?:ç|c)[aã]o|port[aã]o)\s*:\s*/i;

function emptyResult(): ParsedIfoodOrder {
  return {
    orderId: '',
    ifoodId: '',
    confirmationCode: '',
    customerName: '',
    phone: '',
    address: '',
    mapsLink: '',
    isPaid: false,
    paymentMethod: null,
    value: '',
    changeFor: '',
    drinks: [],
    observations: [],
  };
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

function cleanAddressLine(line: string, observations: string[]): string {
  let address = line
    .replace(/\bCEP\s*:?\s*\d{5}-?\d{3}\b/gi, '')
    .replace(/,?\s*Patos de Minas\s*(?:[-/]\s*MG|,\s*MG)?\b/gi, '')
    .replace(/,?\s*Minas Gerais\b/gi, '')
    .replace(/,?\s*MG\b\s*$/gi, '')
    .replace(/(\b\d+)\s*-\s*([A-Za-z]\b)/g, '$1$2');

  const complements = address.match(COMPLEMENT_PATTERN) ?? [];
  for (const complement of complements) {
    const normalized = normalizeSpaces(complement);
    if (normalized && !observations.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      observations.push(normalized);
    }
  }
  address = address.replace(COMPLEMENT_PATTERN, '');

  const parts = address
    .split(/\s+-\s+|\s*[,;]\s*/)
    .map(normalizeSpaces)
    .filter((part) => Boolean(part) && !/^[-–—]+$/.test(part));

  if (parts.length <= 1) return normalizeSpaces(address).replace(/[,-]\s*$/, '');

  const addressParts: string[] = [parts[0]];
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index];
    const lower = part.toLowerCase();
    const isHumanInstruction = /\b(?:port[aã]o|ligar|chamar|interfone|entrada|esquina|em frente|ao lado|casa de|fundos)\b/i.test(part);
    const looksLikeNeighborhood = NEIGHBORHOOD_HINT.test(part) || (index === parts.length - 1 && !isHumanInstruction);

    if (isHumanInstruction && !looksLikeNeighborhood) {
      observations.push(part);
    } else if (!/^(?:casa|resid[eê]ncia)$/i.test(lower)) {
      addressParts.push(part);
    }
  }

  return addressParts.join(' - ').replace(/[,-]\s*$/, '').trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeSpaces(value).toLocaleLowerCase('pt-BR');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function parseIfoodOrderText(text: string): ParsedIfoodOrder {
  const result = emptyResult();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let identifierLine = -1;

  lines.forEach((line, index) => {
    const url = line.match(/https?:\/\/[^\s]+/i)?.[0];
    if (url && /(?:google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)) {
      result.mapsLink = url.replace(/[),.;]+$/, '');
    }

    const lower = line.toLowerCase();
    const tokens = line.replace(/\D+/g, ' ').trim().split(' ').filter(Boolean);
    const canBeIdentifierLine = tokens.length > 0 && !STREET_PATTERN.test(line) && !lower.includes('cep') && !lower.includes('r$') && !lower.includes('total');
    if (!canBeIdentifierLine || !tokens.some((token) => token.length === 8)) return;

    identifierLine = index;
    const eightDigit = tokens.find((token) => token.length === 8);
    const shortTokens = tokens.filter((token) => token.length === 4 || token.length === 5);
    result.ifoodId ||= eightDigit ?? '';
    result.orderId ||= shortTokens[0] ?? '';
    result.confirmationCode ||= shortTokens.find((token) => token.length === 4 && token !== result.orderId) ?? '';
  });

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (index === identifierLine || /^https?:\/\//i.test(line)) return;

    if (/^(?:cliente|nome)\s*:/i.test(line)) {
      result.customerName = line.replace(/^(?:cliente|nome)\s*:\s*/i, '').trim();
      return;
    }

    if (!result.customerName && identifierLine >= 0 && index > identifierLine && index <= identifierLine + 2) {
      const isCandidate = !STREET_PATTERN.test(line) && !/\b(?:cep|pago|cart[aã]o|dinheiro|pix|total)\b/i.test(line) && !/\d+[.,]\d{2}/.test(line);
      if (isCandidate && line.length > 2) {
        result.customerName = line.replace(/^[-•*]\s*/, '').trim();
        return;
      }
    }

    const phone = line.match(/(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/)?.[0];
    if (phone && !result.phone && !lower.includes('cep')) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 11) result.phone = digits;
    }

    const isDrink = /(coca|guaran[aá]|fanta|sprite|suco|refrigerante|cerveja|heineken|[aá]gua|schweppes|del valle)/i.test(line);
    const hasVolume = /(\d+\s*(?:l|ml|litro|litros)|lata|garrafa|600ml|2l|1\.5l|350ml)/i.test(line);
    if (isDrink || (hasVolume && !STREET_PATTERN.test(line) && !/\bap(?:to)?\b/i.test(line))) {
      result.drinks.push(line.replace(/^[-•*x\d\s]+\s*/i, '').trim());
      return;
    }

    if (/\b(?:pago no app|pago online|pedido pago)\b/i.test(line)) {
      result.isPaid = true;
      result.paymentMethod = 'pix';
    } else if (/\b(?:cart[aã]o|cr[eé]dito|d[eé]bito)\b/i.test(line)) {
      result.paymentMethod = 'cartao';
      result.isPaid = false;
    } else if (/\b(?:dinheiro|troco|voltar)\b/i.test(line)) {
      result.paymentMethod = 'dinheiro';
      result.isPaid = false;
    } else if (/\bpix\b/i.test(line)) {
      result.paymentMethod = 'pix';
    }

    const amount = line.match(/(?:r\$\s*)?(\d+[.,]\d{2})/i);
    if (amount && !result.value && !/\b(?:troco|voltar)\b/i.test(line)) result.value = amount[1].replace('.', ',');

    const change = line.match(/troco\s*(?:para|p\/)?\s*(?:r\$\s*)?(\d+[.,]?\d*)/i);
    const returnAmount = line.match(/voltar\s*(?:r\$\s*)?(\d+[.,]?\d*)/i);
    if (change) {
      result.changeFor = change[1].replace('.', ',');
    } else if (returnAmount && amount) {
      const base = Number(amount[1].replace(',', '.'));
      const returned = Number(returnAmount[1].replace(',', '.'));
      if (Number.isFinite(base) && Number.isFinite(returned)) result.changeFor = (base + returned).toFixed(2).replace('.', ',');
    }

    if (STREET_PATTERN.test(line) || /\bCEP\s*:?\s*\d{5}-?\d{3}\b/i.test(line)) {
      result.address = cleanAddressLine(line, result.observations);
      return;
    }

    if (OBSERVATION_PREFIX.test(line)) {
      const observation = line.replace(OBSERVATION_PREFIX, '').trim();
      if (observation) result.observations.push(observation);
    }
  });

  result.drinks = unique(result.drinks);
  result.observations = unique(result.observations);
  return result;
}
