# V110 — Segunda macro de fechamento operacional

## Correções e otimizações

- Modo supermercado: prévia de estoque/custo por produto consolidando TODAS as linhas da compra, inclusive embalagens diferentes. Nenhuma gravação Firestore foi alterada.
- Custos: quando custo antigo é desconhecido, a prévia não inventa estoque anterior comprado a R$ 0,00; segue a regra do ledger real.
- Modo supermercado: paginação visual de 35 itens sem alterar nem descartar o rascunho; pesquisa/filtro abrangem a compra inteira.
- Compras: rascunhos locais não travam a tela quando localStorage está indisponível; avisa o operador e bloqueia saída se o usuário pediu para salvar rascunho e houve falha. O supermercado também informa quando o progresso não pôde ser salvo.
- Alertas: trava por produto/gravidade antes das operações assíncronas; evita disparos concorrentes da mesma ruptura. Respeita app aberto e cooldown.
- PRE-APK: suíte com regras reais e contratos de UI.

## Limites

- Os cálculos da compra exibidos são projeções; quem autoriza movimentar estoque continua sendo a transação com o servidor.
- Os controles não resolvem a falha de mensagens do WhatsApp; próxima frente será diagnóstico Site/worker/VPS, sem reenviar até auditar idempotência.
- Sem novas consultas Firestore, sem deploy, sem alteração de regras de acesso ou assinatura Android.
