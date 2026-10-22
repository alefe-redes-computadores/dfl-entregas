# DFL Entregas R44 — preparação segura e operação mais leve

## Estado de liberação

A regra de produção é **owner-only**. Nenhuma conta de funcionário foi ativada, nenhum flag foi habilitado. Preparar um convite, homologar a identidade e projetar dados **não constitui autorização**.

## Emulador (somente GitHub Action manual)

1. Primeiro rodar `dfl-r44-two-gates-emulator.yml` depois de uma publicação aprovada do código de teste.
2. O job emula a regra OWNER-ONLY em projeto `demo-dfl-entregas-r44-owner` e confirma que mesmo uma conta artificial ativa **não obtém leitura**.
3. Em seguida emula a regra candidata R26 em `demo-dfl-entregas-r43`, conferindo quatro perfis, dados-raiz negados, leituras limitadas e revogação.
4. Os testes são de Rules, **não garantem acesso operacional de produção**: ainda faltam revisão do deploy, regras publicadas, flags, identidade, domínios, processos de aprovação e revogação.
5. Nenhum job faz `firebase deploy`, `vercel deploy`, altera contas reais ou escreve em bancos reais.

## Operação cotidiana

- Entregas aplica filtros baratos antes de construir campos de busca para toda a lista diária; status e modo continuam com o mesmo resultado.
- Rotas calcula concluídas, valor econômico e valor cobrado em uma única passagem por pedido, preservando a identificação das paradas.
- Compras conserva seleção completa inclusive para produtos ocultos pelo lote visual, memoizando derivados.
- Estoque reutiliza contador de zerados sem recalcular o nível de todos os produtos para o indicador de alerta.

## Convites

- Pré-validação de nome, email Google, papel, permissões sensíveis e vínculo com motoboy quando necessário.
- Cadastro incompleto continua sendo possível como rascunho, mas NÃO aparece como pronto para homologação.
- Equipe troca de abas sem exibir conteúdo anterior enquanto aguarda a consulta autorizada.

## Liberação segura

Não publicar Rules candidatas nem ativar funcionários sem consentimento explícito e evidência de testes reais. Este ZIP não publica nem ativa nada.
