# DFL Entregas — R230: circuito de confirmação e recuperação

Base exata: R229-R3 publicada `2420ac9407dd55adcc1a96dd49d868f05967749b`.

## Incluído
- Diário local (máximo 40 entradas, 7 dias) de confirmações de entregas, ordenação, compras, movimentos e integração de estoque, com somente **categoria/timestamps/status/token aleatório**, sem conteúdo de pedido ou dados do cliente. Chave local derivada de UID (o UID real não é armazenado no diário).
- `pending` significa que o `await` da gravação ainda não terminou; **não é confirmação**. Depois de reiniciar a WebView, pendência sem confirmação vira `unverified`; a aplicação não a declara concluída nem a repete automaticamente.
- Erros continuam propagando para o código já existente; proteção de rollback, filas de documentos e `runTransaction` não foram substituídas.
- Banner quando há falta de rede, gravações pendentes ou operações incertas de sessão anterior.
- Diagnóstico do superadmin lista contagens, com botão de **reconhecimento manual** somente após conferir histórico. Reconhecer não grava nem altera pedidos no Firestore.
- Na transição offline→online, quando há falha de sync ou gravações incertas, uma releitura única/limitada pelo cooldown de 3 minutos pode reconciliar o snapshot. Sem timers periódicos, sem novo listener Firestore e sem tentativa de repetir transações.
- Testes de isolamento por usuário, erro propagado, sem replay e validações de TypeScript/AST + PRE-APK integral.

## Delimitações conscientes
- O cache offline do Firestore já está configurado. Este circuito **não é uma segunda outbox** e não oferece replay arbitrário de transações críticas, pois isso poderia duplicar lançamentos. Em perda de energia ou falha de conectividade depois de uma escrita, conferir o histórico antes de tentar novamente.
- O sinal `navigator.onLine` é somente um indício de conectividade; não prova que o servidor recebeu a operação.
- Operações não instrumentadas ainda dependem das confirmações existentes; próximo fechamento R231 revisa as demais operações, navegação e homologação em dois dispositivos.
- Não modifica Firestore Rules, dados de produção ou permissões.

## Segurança e publicação
- Checagens de HEAD local e remoto, stage e working tree vazios, manifesto SHA256, backup rastreado, allowlist, testes dedicados, regressões críticas, tsc --noEmit, PRE-APK completo, stage seletivo, commit/push somente após aprovação; rollback automático em falhas antes do commit.

## R230-R2 — Correção do teste sintático
- O teste dedicado passou a analisar arquivos `.ts` com `ScriptKind.TS` e arquivos `.tsx` com `ScriptKind.TSX`. O store contém o genérico `incrementalCollection = <T>` que em TSX seria interpretado como JSX.
- Incluída regressão positiva e negativa que demonstra a diferença entre os dois analisadores.
- Nenhuma função operacional foi removida, nem contrato desativado; a cirurgia R230 é reaplicada integralmente a partir da R229-R3.
- Em caso de erro sintático real, a mensagem agora inclui diagnósticos do parser.
