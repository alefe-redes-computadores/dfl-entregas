# DFL Entregas R228-R3 — recuperação completa + melhorias operacionais

Base obrigatória: `main` no commit `5b34fc4ff5bc78c46e747688f100e342ee018dcc` (R227). Executar em Termux no repositório `~/projects/dfl-entregas`; não executar a R228-R2 separadamente.

## O que inclui

- Tudo da **R228**: alertas imediatos de pedidos recentes do Site, guardas de recomendação de estoque, busca alfabética, modal adaptativo ao teclado, resumo compacto do radar, organização pós-gravação não bloqueante, animação e retorno de reorganização.
- Tudo da **R228-R2**: rota montando prioritária no cadastro; rota na rua nunca selecionada automaticamente; escolha manual preservada, rotas classificadas por fase; cards com lateral de origem elástica e ações que ocupam a largura disponível.
- **R228-R3**: corrige a tipagem `groups` do seletor (pares categoria e `StockProduct[]`), sem cast `any` ou desabilitar TypeScript.
- Parser de iFood: `5608 76766053` e `76766053 5608` (inclusive `#`, separadores e rótulos explícitos). Números suspeitos em endereços e linhas rotuladas CEP/telefone não são promovidos a cabeçalho. Guia de reconhecimento atualizado na mesma direção.
- Home de balcão/retirada/99Food: substitui `Pago confirmado` redundante por estado operacional (ex.: Concluído) e mostra pendência financeira quando necessária, sem marcar cartão como pago por conclusão física.
- Telemetria: separa tempo de identificação/vínculo do cliente e tempo da confirmação do pedido. Esses dados agregados ficam em Mais → Diagnóstico, sem PII.

## Limitações deliberadas da R3

O atraso de 9–10 segundos **pode não desaparecer**: o cadastro ainda espera confirmação remota do cliente e da entrega. A R228 desliga a auto-organização secundária da espera; a R3 registra cada etapa do gargalo para intervenção posterior. Não marca operação no Firestore como concluída antes de confirmação; não inventa fila durável offline, especialmente para estoque, sem teste de falha/restart/reconciliação. Reengenharia completa do offline-first (outbox persistente, reabertura após crash, sincronização multiaparelhos) fica para uma release posterior controlada e instrumentada.

## Escopo e segurança

Installer fail-closed com hash exato do repo, working-tree limpa, hash remoto, manifesto SHA256 do pacote, backup seletivo externo, scripts Python com âncoras exclusivas, teste R228 + R2 + R3, `tsc --noEmit`, PRE-APK completo, `git diff --check`, inventário allowlist, stage/commit/push **seletivos**. No erro anterior ao commit: rollback seletivo (sem reset hard); no erro após commit: commit preservado e diagnóstico. Não altera Firebase Rules nem ativa recursos comerciais.

## Se falhar

Copiar integralmente a primeira mensagem de erro e o caminho `R228-R3-*` em `~/storage/downloads/dfl-entregas-backups/`. Não forçar push ou aplicar cirurgias adicionais até corrigir.
