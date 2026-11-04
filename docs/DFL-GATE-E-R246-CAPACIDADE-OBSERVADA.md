# DFL ENTREGAS — Gate E R246 — Pressão operacional observada

**Base:** `343df496a817cab83cd09b08a37c873c2be402eb` (R237 publicado), com R243, R244 e R245 aplicadas **somente localmente**.

## Entrega

- Card compacto e progressivo na Home: pressão interna da operação, sem prometer disponibilidade, tempo de entrega ou abertura pública.
- Fonte: retrato Zustand já carregado de pedidos, rotas, motoboys e metadados locais de sincronização. Não cria consultas nem listeners Firestore adicionais.
- Inclui fila sem rota, preparo Site, estado comercial pendente, agendamentos futuros separados, rotas em montagem, rotas na rua e motoboys ativos sem vinculação em rua.
- Exclusões: finalizados, cancelamentos do Site, teste, retiradas/entrega externa da fila logística, agendamentos futuros e dia anterior.
- Proteção de identidade: duas entregas divergentes para mesmo pedido externo contam uma só e geram atenção.
- Confiança por amostra recente de 2h; nunca chama esse score de disponibilidade real. Requer sincronização recente até 6 minutos e rede presente.
- Queda de rede, sync antigo, falha e operação local fechada forçam `unknown` — não anunciam condição otimista.
- Histerese de 2 minutos para reduzir melhorias oscilantes; agravamento e perda de evidência prevalecem imediatamente.
- Override manual **somente nesta tela** (React memory), que não sobrepõe status desconhecido, nem publica sinais.
- Não importa nenhum estado de abertura do Site. A autoridade comercial do Site continua soberana; `storeSettings.isOpen` representa somente marcação local e não é propagada.

## NÃO FAZ

NÃO ativa capacidade pública, nem muda a disponibilidade do Site. NÃO envia WhatsApp, NÃO publica mensagens e NÃO calcula ETA. NÃO cria fiados, eventos financeiros, pedidos, rotas ou vendas. NÃO altera Firebase Rules/API, V3 OFF permanece protegido pelas R242–R244.

## Arquivos

- Novos: `lib/operation/operational-demand-signal.ts`, `components/home/OperationalDemandCard.tsx`, `scripts/test-r246-operational-demand.cjs`, `docs/DFL-GATE-E-R246-CAPACIDADE-OBSERVADA.md`.
- Modificados: `app/page.tsx` e `scripts/pre-apk.cjs` (somente inserções exatas com validação).

## Gate

- Pré-APK esperado **303 suítes** (300 R243 + 1 R244 + 1 R245 + 1 R246).
- TypeScript integral + R246, R245, R244, R243, R242, regressões R237/R236/R234 + git diff --check.
- PREVIEW significa código local não publicado; esse gate não substitui homologação Android, Firestore, mensagem nem disponibilidade pública.

## Checklist real no Android (após futura publicação autorizada)

1. Com rede e sync recente: conferir fila, preparo, motoboys e rotas com dados reais; não usar métricas como ETA.
2. Desligar rede e confirmar estado desconhecido, inclusive se override manual estiver selecionado.
3. Após >6 minutos sem nova sync, verificar que estado se torna desatualizado.
4. Em dia sem movimento, verificar que não anuncia demanda baixa como fato.
5. Com SyncError, verificar que nunca mostra operação pronta como prova.
6. Alternar pressão no teste: queda só após 2 minutos estáveis; aumento é imediato.
7. Site fechado com Entregas local aberto: não divulgar nenhum estado público da loja.
