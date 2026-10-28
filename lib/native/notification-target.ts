/** R135: destinos locais e previsiveis para toque em notificacao do Android. */
type NoticeEntity = { id: string };
type NotificationExtras = Record<string, unknown> | null | undefined;

function safeIdentifier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > 180 || /[\u0000-\u001f\u007f/\\?#]/.test(value)) return null;
  return value;
}

export function safeNotificationHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  // Nao aceitar caminhos que o navegador possa reinterpretar como //host.
  const pathname = raw.split(/[?#]/, 1)[0];
  if (!pathname || /%(?:2f|5c|00)/i.test(pathname)) return null;
  if (pathname.split('/').some(segment => segment === '..' || segment === '.')) return null;
  return raw;
}

/** Nunca construi URL usando dados nao validados de notificacoes externas. */
export function notificationTargetHref(extra: NotificationExtras): string | null {
  if (!extra || typeof extra !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(extra, 'href')) {
    return safeNotificationHref(extra.href);
  }
  const id = safeIdentifier(extra.dflEntityId);
  if (!id) return null;
  const encoded = encodeURIComponent(id);
  switch (extra.dflTargetType) {
    case 'delivery': return `/entregas/details?id=${encoded}`;
    case 'delivery-edit': return `/entregas/editar?id=${encoded}`;
    case 'site-order': return `/loja/caixa-de-entrada?aba=site&pedido=${encoded}`;
    case 'route': return `/rotas/details?id=${encoded}`;
    case 'stock-product': return `/estoque/detalhes?id=${encoded}`;
    case 'stock-supply': return `/abastecimentos/detalhes?id=${encoded}`;
    default: return null;
  }
}

/** Um unico objeto operacional merece destino especifico; varios vao a lista. */
export function routeReminderHref(routes: readonly NoticeEntity[]): string {
  const id = routes.length === 1 ? safeIdentifier(routes[0]?.id) : null;
  return id ? `/rotas/details?id=${encodeURIComponent(id)}` : '/rotas';
}

export function stockThresholdHref(products: readonly NoticeEntity[]): string {
  const id = products.length === 1 ? safeIdentifier(products[0]?.id) : null;
  return id ? `/estoque/detalhes?id=${encodeURIComponent(id)}` : '/estoque/compras';
}
