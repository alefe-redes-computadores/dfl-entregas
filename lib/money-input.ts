export const formatBRLCents = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const cents = Number(digits || '0');
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const moneyToNumber = (value: string) => Number(value.replace(/\D/g, '') || '0') / 100;

export const numberToBRLInput = (value?: number) => formatBRLCents(String(Math.round((value || 0) * 100)));
