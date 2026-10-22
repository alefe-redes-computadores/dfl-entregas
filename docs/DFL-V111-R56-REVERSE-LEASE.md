# DFL Entregas V111 R56 — autoridade do claim de integração

## Defeito corrigido

Ao expirar o lock de um evento na `integration_outbox`, outro worker poderia reclamá-lo. Antes da R56, o worker original ainda podia gravar `sent` ou `failed` sem conferir se era o dono atual do claim. Em condições de latência, isso corrompia o estado operacional do outbox.

## Contrato

- Cada claim traz `workerId` e `attempts`.
- Tanto `sent` quanto `failed` usam `adminDb.runTransaction` e leem o mesmo documento antes de gravar. Só alteram um evento `processing` cujo `locked_by` e `attempts` coincidam.
- Se outro worker retomou o evento, a conclusão antiga retorna `false`, sem escrita. O relay não declara sucesso nesse caso.
- O vencimento por tempo permite outro worker recuperar o claim, mas não autoriza a escrita do worker antigo **após** a recuperação.
- O identificador estável do evento é preservado para idempotência no destino; o isolamento da transação não evita que dois requests externos já tenham sido enviados quando um lock expira. O site ainda precisa deduplicar eventos por ID.
- Uma conclusão legítima passa a gastar **uma leitura transacional adicional por evento**, além da leitura que já existia para o claim. Não foi criada consulta automática, polling, listener ou varredura histórica.
- Diagnóstico de outbox ordena datas inválidas por último, com desempate determinístico por ID.
- O teste envolve reclaims, erros atrasados, falhas legítimas, retentativas, `dead_letter` e lock de outro worker em um Firestore simulado. **Firebase Emulator real continua pendente.**

## Publicação

Somente instalação local. Não faz commit, push, deploy, migração, alteração de Rules, flags nem ativação de equipe. O acesso de funcionário continua sob bloqueio até a homologação de Firebase Emulator e autorização expressa.
