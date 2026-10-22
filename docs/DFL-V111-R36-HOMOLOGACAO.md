# V111 R36 — Sincronização transacional com prova de prévia

## Escopo

- Atualizações de projeções **apenas de contas suspensas**, realizadas manualmente pelo proprietário.
- Flag `DFL_STAFF_PROJECTION_REFRESH_ENABLED` continua **OFF** por padrão.
- Prévia considera o estado projetado **e** o estado original; nunca retorna valores privados.
- No commit, lê conta, rascunho, rotas, entregas, compras/estoque autorizados e projeções atuais **dentro da mesma transação**.
- Mudança no UID, vínculo, permissões, origem ou projeções entre prévia e commit aborta a transação sem escrita.
- Escrita por delta: documentos inalterados não são regravados. No-op não cria movimentação, evento de auditoria ou nova versão.
- Nenhuma alteração nas coleções operacionais originais, nas regras de produção ou no login staff.

## Limites e observabilidade

A comparação é limitada às coleções e ao número de documentos estabelecidos na R35. Portanto **não significa sincronização integral de toda a loja**. Também não garante que serviços externos de autenticação não mudem entre a confirmação inicial e a transação Firestore; os funcionários continuam suspensos.

O hash da prévia é calculado exclusivamente no servidor. Se expirar ou houver mudanças, o operador deve repetir a prévia. O erro retorna apenas um texto genérico, sem dados de clientes.

## Homologação em ambiente isolado

O workflow opcional `DFL R36 - Transacoes isoladas de projecoes` utiliza `demo-dfl-entregas-r36` e Firebase Emulator local em GitHub Actions. Não utiliza credenciais, banco ou Rules de produção. O CI só pode ser executado após publicação **separada e autorizada** dos arquivos no repositório. Instalar a R36 no Termux não executa esse workflow e não habilita as flags.
