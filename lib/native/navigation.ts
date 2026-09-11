// lib/native/navigation.ts

function normalizePath(pathname: string) {
  const clean = pathname.replace(/\/+$/, '');
  return clean || '/';
}

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function withParams(
  pathname: string,
  params: URLSearchParams,
  keys: string[],
) {
  const next = new URLSearchParams();
  keys.forEach((key) => {
    const value = params.get(key);
    if (value) next.set(key, value);
  });
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function nativeBackTarget(pathname: string, search = ''): string | null {
  const path = normalizePath(pathname);
  const params = new URLSearchParams(search);

  // Raízes operacionais: botão Android minimiza o app.
  if (path === '/' || path === '/loja') return null;

  // Fluxo externo de confirmação: respeita o retorno explícito do próprio fluxo.
  if (path === '/confirmar') {
    return safeInternalPath(params.get('returnTo')) || '/confirmacoes';
  }

  // Edição deve voltar ao detalhe da mesma entidade, sem depender do histórico.
  if (path === '/entregas/editar') {
    const id = params.get('id');
    return id
      ? withParams('/entregas/details', params, ['id', 'date'])
      : withParams('/entregas', params, ['date']);
  }

  if (path === '/rotas/editar') {
    const id = params.get('id');
    return id
      ? withParams('/rotas/details', params, ['id', 'date'])
      : withParams('/rotas', params, ['date']);
  }

  if (path === '/clientes/editar') {
    const id = params.get('id');
    return id ? `/clientes/details?id=${encodeURIComponent(id)}` : '/clientes';
  }

  if (path === '/motoboys/editar' || path === '/motoboys/acerto') {
    const id = params.get('id');
    return id ? `/motoboys/details?id=${encodeURIComponent(id)}` : '/motoboys';
  }

  if (path === '/abastecimentos/editar') {
    const id = params.get('id');
    return id
      ? `/abastecimentos/detalhes?id=${encodeURIComponent(id)}`
      : '/abastecimentos';
  }

  if (path === '/estoque/editar' || path === '/estoque/movimentar') {
    const id = params.get('id');
    return id
      ? `/estoque/detalhes?id=${encodeURIComponent(id)}`
      : '/estoque';
  }

  // Detalhes e cadastros voltam ao pai canônico.
  if (path === '/entregas/details' || path === '/entregas/nova') {
    return withParams('/entregas', params, ['date']);
  }

  if (path === '/rotas/details' || path === '/rotas/nova') {
    return withParams('/rotas', params, ['date']);
  }

  if (path === '/clientes/details' || path === '/clientes/novo' || path === '/clientes/duplicados') {
    return '/clientes';
  }

  if (path === '/motoboys/details' || path === '/motoboys/novo') {
    return '/motoboys';
  }

  if (path === '/abastecimentos/detalhes' || path === '/abastecimentos/novo') {
    return '/abastecimentos';
  }

  if (
    path === '/estoque/detalhes' ||
    path === '/estoque/novo' ||
    path === '/estoque/contagem' ||
    path === '/estoque/compras' ||
    path === '/estoque/relatorios' ||
    path === '/estoque/arquivados' ||
    path === '/estoque/fornecedores' ||
    path === '/estoque/precos' ||
    path === '/estoque/catalogo'
  ) {
    return '/estoque';
  }

  if (path === '/despesas/novo') return '/despesas';

  // Hubs/listas de segundo nível.
  if (
    path === '/entregas' ||
    path === '/rotas' ||
    path === '/clientes' ||
    path === '/motoboys' ||
    path === '/abastecimentos' ||
    path === '/estoque' ||
    path === '/equipe' ||
    path === '/despesas'
  ) {
    return '/loja';
  }

  // Central hoje possui retorno canônico para Mais.
  if (path === '/confirmacoes') return '/mais';

  // Relatórios e Mais retornam ao comando principal.
  if (path === '/relatorios' || path === '/mais') return '/';

  // Página desconhecida: nunca reintroduzir loop de histórico.
  return '/';
}
