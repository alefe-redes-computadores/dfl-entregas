// lib/operational-address.ts

const compact = (value?: string) =>
  (value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+-\s+/g, " - ")
    .trim();

export function hasHouseNumber(value?: string): boolean {
  return /\d/.test(value || "");
}

export function bestOperationalAddress(
  deliveryAddress?: string,
  customerAddress?: string,
): string {
  const delivery = compact(deliveryAddress);
  const customer = compact(customerAddress);

  if (!delivery) return customer;
  if (!customer) return delivery;

  if (!hasHouseNumber(delivery) && hasHouseNumber(customer)) return customer;
  return delivery;
}

export function compactAddressForCard(
  deliveryAddress?: string,
  customerAddress?: string,
  neighborhood?: string,
): string {
  const full = bestOperationalAddress(deliveryAddress, customerAddress);
  if (!full) return "Endereço não informado";

  const nb = compact(neighborhood);
  if (!nb) return full;

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  return normalize(full).includes(normalize(nb)) ? full : `${full} · ${nb}`;
}
