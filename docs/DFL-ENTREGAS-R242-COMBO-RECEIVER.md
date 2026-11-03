# DFL Entregas — R242 | Receptor seguro de combos por lanche

**Base obrigatória:** `76c6fe7920954c679a67b56ca7aed788b47188a9` (Entregas R233).
**Produtor auditado:** DFL SITE R241 `7c19aa5635bcef976934254cc04c2bfbd6a84e2b`.

## Problema confirmado

O DFL SITE envia atualmente `orderSchemaVersion: 2` (envelope de eventos `schema_version: 1`). O Entregas valida apenas `orderSchemaVersion >= 1` e converte o snapshot comercial em `selected_addons` e `observation` **por linha**, sem suportar a personalização de unidades internas. Uma versão 3 ou campos novos de unidade poderiam ser aceitos e perder as escolhas individuais sem aviso.

## Entrega R242

1. `lib/integration/site-combo-unit-guard.ts` — proteção ativa no validador do Site: permite somente schema 1 ou 2, barra schema 3+ e detecta campos experimentais de unidade inclusive dentro de `itens/components`. O campo legítimo `unitPrice` continua permitido. Nenhum evento atual é convertido para novo formato.
2. `lib/integration/site-order.ts` — chama a verificação **antes** de `order.created`/`order.updated` alcançarem a persistência; assinatura HMAC, identidade externa, caixa de entrada e idempotência permanecem intactas.
3. `lib/integration/site-combo-unit-preview.ts` — leitor **isolado, sem I/O**, para o objeto de diagnóstico R241. Valida versão, 14 unidades, autorização negativa, composição por combo, preços em centavos, adicionais, remoções, observações, contadores, repetição e checksum *diagnóstico* (não é assinatura de segurança). Gera prévias de cozinha sem imprimí-las nem persistí-las.
4. `scripts/fixtures/r241-site-combo-7-uai.json` — arquivo JSON produzido pelo motor real R241 do Site, 2 Combos 7 Uai, 14 unidades e total **simulado** de R$159,48 (preços de adicionais exclusivamente fictícios).
5. `scripts/test-r242-site-combo-receiver.cjs` — provas automatizadas do leitor, validação de payload real, rejeição de campos não suportados, preservação dos snapshots legados e de todos os bloqueios operacionais. Incluído em `.github/workflows/main.yml` antes do build Android.

## Não altera

- `siteOrderPersistence.ts`, Firestore ou regras de segurança;
- preços de produtos ou adicionais, checkout, cobrança, rotas, estoque ou status;
- geração/uso de outbox, `order.created`, HMAC, assinatura e idempotência;
- design ou navegação do aplicativo Entregas;
- integração real entre Site e Entregas: **ainda não há suporte produtivo a pedidos personalizados por unidade**.

## Homologação

Instalador confere SHA-256 dos arquivos, branch `main`, HEAD exato, modificações locais/stage e allowlist; faz backup seletivo. Em falha durante testes, restaura apenas os dois arquivos rastreados e remove os novos. Executa teste novo, gate `pre-apk`, `tsc --noEmit`, verificação existente de bebidas e `git diff --check`; apenas então realiza commit/push **seletivos**.

O pacote foi ensaiado em um Git mock para falha proposital e commit seletivo sem push. **O comportamento na operação real continua sujeito ao gate no Termux e à Action GitHub após publicar.**

## Próximos passos após R242

- **R243 — apresentação de preparo no Entregas:** prévia de unidades no detalhe do pedido e futura bobina 58/80 mm em ambiente de teste, sem mostrar dados experimentais como pedidos reais.
- **Site — interface de personalização:** seleção de um/todos/vários lanches, revisão dos extras e resumo para o cliente, mantendo desativado até homologação de preço no servidor.
- **Ativação conjunta:** migrar contrato real com feature flag, validação de `orderSchemaVersion: 3`, snapshot sem perdas, teste de pedido real controlado com aprovação do operador, rollback.
- **DFL Assist contextual:** linha paralela aprovada; evitar acoplar ao processamento de pedidos.
