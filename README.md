# DFL Entregas — Fase 1


Fundação do app: tipagens, store Zustand (mock), layout (Header + BottomNav) e a tela Início com Accordions de rotas + DeliveryCard funcional.

## Como rodar

```bash

npm install
npm run dev

```

Abre em `http://localhost:3000`.

## O que já funciona nesta fase

- **`types/index.ts`** — interfaces `Route`, `Delivery`, `Customer`.
- **`store/useAppStore.ts`** — Zustand com dados mockados (`lib/mock-data.ts`), filtro de data e seletores (`getDeliveriesByRoute`, `getCustomerById`).
- **`components/layout/Header.tsx`** — saudação dinâmica (bom dia/tarde/noite), avatar e bolinha verde pulsante de sincronização.
- **`components/layout/BottomNav.tsx`** — 5 ações com FAB central abrindo bottom sheet ("Adicionar Rota" / "Adicionar Entrega" — os formulários entram na Fase 2).
- **`app/page.tsx`** + **`components/home/RouteAccordion.tsx`** — Home com rotas abertas/fechadas em accordion.
- **`components/home/DeliveryCard.tsx`** + **`lib/whatsapp.ts`** — card da entrega com `order_id` em destaque, mini-mapa placeholder, e botão de copiar que gera exatamente:

```
[ORDER_ID]
[Endereço limpo]
OBS: [Observação]
🗺️ [Link do maps]
[PAGO] / [DINHEIRO] troco para [X] / [CARTÃO] levar maquininha

[Bebidas]
```

Usa `sonner` pra feedback (toast), sem `alert()`/`confirm()` nativos.

## Próximas fases (aguardando aprovação)

1. Telas de **Adicionar** (formulários de Rota e Entrega, com validação de rota aberta).
2. **Relatórios** com `recharts` (pizza de pagamentos, barras de bairros, linha de evolução).
3. **Clientes** (lista + busca + filtro de bairro).
4. **Mais** (config, tema, e o WebView mascarado do iFood — "DFL Confirmar Entregas").

## Notas técnicas

- `next.config.js` já está com `output: 'export'` pra empacotar no Capacitor depois.
- Paleta: fundo zinc/slate escuro, primária esmeralda (sync/sucesso), secundária âmbar (ação/FAB).
- Tipografia: Poppins nos headings (`font-heading`), Inter no corpo (`font-body`).
- Store 100% local-first por enquanto — a integração com Supabase entra depois, mantendo a mesma interface de seletores.
