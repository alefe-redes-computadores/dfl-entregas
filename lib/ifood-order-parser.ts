import type { Delivery } from '@/types';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';

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
  customerCharge: string;
  subsidy: string;
  changeFor: string;
  drinks: string[];
  observations: string[];
  routeNumber: string;
  motoboyHint: string;
}

const STREET =
  /(?:\br\.(?=\s)|\b(?:rua|av\.?|avenida|alameda|travessa|pra[cç]a|rodovia|estrada|beco|viela)\b)/i;

const POSTAL =
  /\b(?:cep\s*:?\s*)?\d{5}-?\d{3}\b/i;

const POSTAL_ONLY =
  /^\s*(?:cep\s*:?\s*)?\d{5}-?\d{3}\s*$/i;

const URL = /https?:\/\/[^\s<>()]+/gi;

const MAP_HOST =
  /(?:google\.[^/]+\/(?:maps|url)|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

const OBS_PREFIX =
  /^(?:obs(?:erva(?:ç|c)[aã]o)?|observa[cç][oõ]es?|refer[eê]ncia|complemento|instru(?:ç|c)[aã]o|instru[cç][oõ]es?|port[aã]o|nota)\s*:\s*/i;

const INSTRUCTION =
  /\b(?:ap(?:to|artamento)?\.?|bloco|casa|fundos|andar|sala|lote|quadra|port[aã]o|interfone|ligar|chamar|entrada|esquina|em frente|ao lado|pr[oó]ximo|casa de|deixar|tocar|buzinar|sem cebola|sem salada|retirar|adicionar|caprichar|separar|mandar|enviar)\b/i;

const DRINK_WORD =
  /\b(?:bebida|bebidas|coca(?:-cola)?|guaran[aá]|fanta|sprite|suco|refrigerante|cerveja|heineken|[aá]gua(?:\s+mineral)?|schweppes|del\s+valle|kuat|pepsi)\b/i;

const FINANCIAL =
  /\b(?:r\$|valor|total|pagamento|pago|paga|pix|cart[aã]o|cr[eé]dito|d[eé]bito|dinheiro|troco|cupom|subs[ií]dio|desconto|cliente\s+paga|cobrar)\b/i;

const emptyResult = (): ParsedIfoodOrder => ({
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
  customerCharge: '',
  subsidy: '',
  changeFor: '',
  drinks: [],
  observations: [],
  routeNumber: '',
  motoboyHint: '',
});

const spaces = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();

const normalized = (value: string) =>
  spaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

const numberValue = (value: string) => {
  const clean = value.replace(/\s/g, '');
  return Number(
    clean.includes(',')
      ? clean.replace(/\./g, '').replace(',', '.')
      : clean,
  );
};

const currency = (value: number) =>
  value.toFixed(2).replace('.', ',');

function addUnique(target: string[], value: string) {
  const clean = spaces(value)
    .replace(/^[-–—,;]+|[-–—,;]+$/g, '')
    .trim();

  const key = normalized(clean);

  if (
    clean &&
    !target.some((item) => normalized(item) === key)
  ) {
    target.push(clean);
  }
}

function mapUrl(line: string) {
  return (
    (line.match(URL) ?? [])
      .find((value) => MAP_HOST.test(value))
      ?.replace(/[),.;]+$/, '') ?? ''
  );
}

function idTokens(line: string) {
  if (
    STREET.test(line) ||
    POSTAL.test(line) ||
    /\btotal\b|r\$/i.test(line)
  ) {
    return [];
  }

  return line
    .replace(/\D+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function cleanAddress(
  source: string,
  observations: string[],
) {
  const value = source
    .replace(/^end(?:ere[cç]o)?\s*:\s*/i, '')
    .trim();

  const result = canonicalizeOperationalAddress(value);

  result.observations.forEach((item) =>
    addUnique(observations, item),
  );

  return result.address;
}

function looksLikeAddress(line: string) {
  if (!line || POSTAL_ONLY.test(line)) return false;
  if (STREET.test(line)) return true;
  if (/^end(?:ere[cç]o)?\s*:/i.test(line)) return true;

  if (
    DRINK_WORD.test(line) ||
    FINANCIAL.test(line) ||
    OBS_PREFIX.test(line)
  ) {
    return false;
  }

  const hasHouseNumber =
    /(?:^|[,\s])\d{1,5}[A-Za-z]?(?=\s*(?:$|[-,/]))/.test(
      line.replace(POSTAL, ' '),
    );

  const hasAddressSeparator =
    /,\s*\d{1,5}[A-Za-z]?\b/.test(line) ||
    /\s[-–—]\s/.test(line);

  const hasGeoWord =
    /\b(?:bairro|residencial|vila|jardim|centro|condom[ií]nio|setor)\b/i.test(
      line,
    );

  return (
    hasHouseNumber &&
    (hasAddressSeparator || hasGeoWord) &&
    /[A-Za-zÀ-ÿ]{3}/.test(line)
  );
}

function explicitNeighborhood(line: string) {
  const match = line.match(
    /^(?:bairro|setor)\s*:?\s*(.+)$/i,
  );

  if (!match) return '';

  const value = spaces(
    match[1].replace(POSTAL, ' '),
  );

  if (
    !value ||
    POSTAL.test(value) ||
    /^\d[\d\s.-]*$/.test(value)
  ) {
    return '';
  }

  return value;
}

function parsePayment(
  line: string,
  result: ParsedIfoodOrder,
) {
  const negative =
    /\b(?:n[aã]o\s+pago|pagamento\s+pendente|pix\s+pendente|pagar\s+na\s+entrega)\b/i.test(
      line,
    );

  const cash = /\b(?:dinheiro|troco|voltar)\b/i.test(line);
  const card =
    /\b(?:cart[aã]o|cr[eé]dito|d[eé]bito|maquininha)\b/i.test(
      line,
    );

  const paid =
    !negative &&
    !cash &&
    !card &&
    /\b(?:pago|paga|pagamento\s+(?:online|pago|confirmado|aprovado|ok)|pedido\s+pago|j[aá]\s+pago|pago\s+(?:no\s+app|online)|pix\s+(?:pago|confirmado|aprovado|ok))\b/i.test(
      line,
    );

  if (card) {
    result.paymentMethod = 'cartao';
    result.isPaid = false;
    result.changeFor = '';
    return;
  }

  if (cash) {
    result.paymentMethod = 'dinheiro';
    result.isPaid = false;
    return;
  }

  if (paid) {
    result.paymentMethod = 'pix';
    result.isPaid = true;
    result.changeFor = '';
    return;
  }

  if (/\bpix\b/i.test(line)) {
    result.paymentMethod = 'pix';
    result.isPaid =
      !negative &&
      /\b(?:pago|confirmado|aprovado|ok|online)\b/i.test(
        line,
      );
  }
}

function parseRouteHint(
  line: string,
  result: ParsedIfoodOrder,
) {
  const route = line.match(
    /\brota\s*(?:n[ºo°.]?\s*)?(\d{1,2})\b/i,
  );

  if (route) result.routeNumber ||= route[1];

  const motoboy = line.match(
    /\b(?:motoboy|entregador)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40})$/i,
  );

  if (motoboy) {
    result.motoboyHint ||= spaces(motoboy[1]);
  }
}

function parseFinancial(
  line: string,
  result: ParsedIfoodOrder,
) {
  const explicit = line.match(
    /(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:[,;|-]\s*)?(?:em\s+)?(?:dinheiro\s*)?(?:com\s+)?troco\s+(?:para|p\/?|de)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
  );

  if (explicit) {
    const base = numberValue(explicit[1]);
    const tendered = numberValue(explicit[2]);

    if (Number.isFinite(base)) {
      result.customerCharge ||= currency(base);
      result.value ||= currency(base);
    }

    if (Number.isFinite(tendered)) {
      result.changeFor = currency(tendered);
    }
  }

  const tokens = [
    ...line.matchAll(
      /(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi,
    ),
  ].map((match) => ({
    value: numberValue(match[1]),
    index: match.index ?? 0,
  }));

  const changeIndex = line.search(
    /\b(?:troco|voltar)\b/i,
  );

  const baseToken = tokens.find(
    (token) =>
      changeIndex < 0 || token.index < changeIndex,
  );

  if (
    !result.customerCharge &&
    /\b(?:valor|pagamento|pago|pix|cart[aã]o|dinheiro|troco|voltar|cobrar|cliente\s+paga)\b/i.test(
      line,
    ) &&
    baseToken &&
    Number.isFinite(baseToken.value)
  ) {
    result.customerCharge = currency(baseToken.value);
    result.value ||= result.customerCharge;
  }

  const base = result.customerCharge
    ? numberValue(result.customerCharge)
    : baseToken?.value;

  const tendered = line.match(
    /\btroco\s+(?:para|p\/?|de)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
  );

  const returned =
    line.match(
      /\b(?:troco|voltar)\s*(?!para\b|p\/?\b|de\b)(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
    ) ||
    line.match(
      /(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+de\s+troco\b/i,
    );

  if (!result.changeFor && tendered) {
    const value = numberValue(tendered[1]);
    if (Number.isFinite(value)) {
      result.changeFor = currency(value);
    }
  } else if (
    !result.changeFor &&
    returned &&
    Number.isFinite(base)
  ) {
    const value = numberValue(returned[1]);
    if (Number.isFinite(value)) {
      result.changeFor = currency(
        (base as number) + value,
      );
    }
  }

  const subsidy =
    line.match(
      /\b(?:cupom|subs[ií]dio|desconto\s+ifood|ifood\s+paga|ifood\s+subsidia)\s*[:\-]?\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
    ) ||
    line.match(
      /(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:de\s+)?(?:cupom|subs[ií]dio)\b/i,
    );

  if (subsidy) {
    const value = numberValue(subsidy[1]);

    if (Number.isFinite(value) && value >= 0) {
      result.subsidy = currency(value);

      if (result.customerCharge) {
        const charge = numberValue(
          result.customerCharge,
        );

        if (Number.isFinite(charge)) {
          result.value = currency(charge + value);
        }
      }
    }
  }

  const total = line.match(
    /\b(?:valor\s+total|total\s+do\s+pedido|total)\s*[:\-]?\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
  );

  if (total && !/\btroco\b/i.test(line)) {
    const value = numberValue(total[1]);

    if (Number.isFinite(value)) {
      result.value = currency(value);

      if (
        !result.customerCharge &&
        !result.subsidy
      ) {
        result.customerCharge = result.value;
      }
    }
  }
}

export function parseIfoodOrderText(
  text: string,
): ParsedIfoodOrder {
  const result = emptyResult();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let idLine = -1;
  let neighborhood = '';

  // Primeira passada: IDs e link do Maps.
  lines.forEach((line, index) => {
    const url = mapUrl(line);

    if (url) result.mapsLink = url;

    const tokens = idTokens(line);

    if (!tokens.some((token) => token.length === 8)) {
      return;
    }

    if (idLine < 0) idLine = index;

    result.ifoodId ||=
      tokens.find((token) => token.length === 8) ?? '';

    const short = tokens.filter(
      (token) =>
        token.length === 4 || token.length === 5,
    );

    result.orderId ||= short[0] ?? '';

    result.confirmationCode ||=
      short.find(
        (token) =>
          token.length === 4 &&
          token !== result.orderId,
      ) ?? '';
  });

  lines.forEach((original, index) => {
    const line = spaces(
      original.replace(URL, ' '),
    );

    if (!line || index === idLine) return;

    // CEP isolado nunca é endereço, bairro, bebida ou número da casa.
    if (POSTAL_ONLY.test(line)) return;

    const nb = explicitNeighborhood(line);

    if (nb) {
      neighborhood ||= nb;
      return;
    }

    if (/^(?:cliente|nome)\s*:/i.test(line)) {
      result.customerName = line
        .replace(
          /^(?:cliente|nome)\s*:\s*/i,
          '',
        )
        .trim();
      return;
    }

    // Endereço vem antes de bebida para impedir que "123 Lote..."
    // ou textos semelhantes sejam classificados como volume.
    if (looksLikeAddress(line)) {
      const parsedAddress = cleanAddress(
        original,
        result.observations,
      );

      if (parsedAddress) {
        result.address = parsedAddress;
      }

      return;
    }

    if (
      !result.customerName &&
      idLine >= 0 &&
      index > idLine &&
      index <= idLine + 2 &&
      !looksLikeAddress(line) &&
      !POSTAL.test(line) &&
      !FINANCIAL.test(line) &&
      !OBS_PREFIX.test(line) &&
      !INSTRUCTION.test(line) &&
      !DRINK_WORD.test(line) &&
      !/\d+[.,]\d{2}/.test(line)
    ) {
      result.customerName = line
        .replace(/^[-•*]\s*/, '')
        .trim();
      return;
    }

    const phone = line.match(
      /(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/,
    )?.[0];

    if (
      phone &&
      !result.phone &&
      !POSTAL.test(line)
    ) {
      const digits = phone.replace(/\D/g, '');

      if (
        digits.length >= 10 &&
        digits.length <= 11
      ) {
        result.phone = digits;
      }
    }

    if (OBS_PREFIX.test(line)) {
      addUnique(
        result.observations,
        line.replace(OBS_PREFIX, ''),
      );
      return;
    }

    if (
      INSTRUCTION.test(line) &&
      !FINANCIAL.test(line)
    ) {
      addUnique(result.observations, line);
      return;
    }

    // Bebida exige evidência lexical explícita.
    // "2 L" sozinho não é mais suficiente.
    if (
      DRINK_WORD.test(line) &&
      !POSTAL.test(line)
    ) {
      addUnique(
        result.drinks,
        line.replace(
          /^[-•*]\s*/,
          '',
        ),
      );
      return;
    }

    parseRouteHint(line, result);

    if (
      result.routeNumber &&
      /\brota\b/i.test(line)
    ) {
      return;
    }

    parsePayment(line, result);
    parseFinancial(line, result);
  });

  if (result.address && neighborhood) {
    result.address = cleanAddress(
      `${result.address} - ${neighborhood}`,
      result.observations,
    );
  }

  if (!result.customerCharge && result.value) {
    result.customerCharge = result.value;
  }

  if (
    result.subsidy &&
    result.customerCharge
  ) {
    const charge = numberValue(
      result.customerCharge,
    );
    const subsidy = numberValue(result.subsidy);

    if (
      Number.isFinite(charge) &&
      Number.isFinite(subsidy)
    ) {
      result.value = currency(charge + subsidy);
    }
  }

  return result;
}

export function parseIfoodOrdersText(
  text: string,
): ParsedIfoodOrder[] {
  const lines = text.split(/\r?\n/);

  const headers = lines
    .map((line, index) => ({
      index,
      tokens: idTokens(line),
    }))
    .filter((item) =>
      item.tokens.some(
        (token) => token.length === 8,
      ),
    )
    .map((item) => item.index);

  if (headers.length <= 1) {
    return [parseIfoodOrderText(text)];
  }

  const shared = parseIfoodOrderText(text);

  return headers.map((start, position) => {
    const end =
      headers[position + 1] ?? lines.length;

    const parsed = parseIfoodOrderText(
      lines.slice(start, end).join('\n'),
    );

    return {
      ...parsed,
      address: parsed.address || shared.address,
      mapsLink:
        parsed.mapsLink || shared.mapsLink,
      phone: parsed.phone || shared.phone,
      routeNumber:
        parsed.routeNumber ||
        shared.routeNumber,
      motoboyHint:
        parsed.motoboyHint ||
        shared.motoboyHint,
      observations: parsed.observations.length
        ? parsed.observations
        : [...shared.observations],
    };
  });
}
