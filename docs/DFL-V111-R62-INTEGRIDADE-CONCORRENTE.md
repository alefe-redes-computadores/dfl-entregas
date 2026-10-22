# DFL Entregas V111 — R62 | Integridade local em falhas concorrentes

## Escopo

A R61 iniciou rollback granular nas operações de Fornecedores, Estoque e Equipe administrativa. A R62 estende a mesma regra para adição, edição ou exclusão de Rotas, Motoboys, Compras/Abastecimentos, Clientes, Entregas, Confirmações iFood e Despesas.

- **Atualização:** restaurar a versão anterior somente se a store ainda exibir a mesma instância otimista da tentativa que falhou.
- **Criação:** remover somente a instância otimista criada pela operação falha. Não eliminar o mesmo ID caso uma sincronização tenha substituído sua instância.
- **Exclusão:** reinserir só o registro excluído, sem substituir a lista nem duplicar outro cadastro com o mesmo ID.
- **Lote e unificação:** restaurar apenas os registros que ainda conservam as instâncias otimistas; manter registros de outras operações.
- **Pós-commit:** confirmação persistida no Firestore continua autoridade; uma falha posterior de notificação/fechamento não desfaz gravação já confirmada.

## Restrições intencionais

Nenhuma Rule, esquema de coleção, migração, flag, listener, consulta periódica ou acesso de funcionários é alterado. O rollback granular protege o estado da sessão React; não constitui bloqueio distribuído nem resolve automaticamente conflitos entre dispositivos. A resolução de estado remoto continua sob a autoridade dos fluxos existentes do Firebase.

## Validação

Contratos sintáticos + cenários de concorrência, regressões R61 e PRE-APK com 206 suítes. TypeScript real e PRE-APK integrado são exigidos no Termux. O Firebase Emulator de perfis permanece uma homologação separada e não foi executado nesta cirurgia.
