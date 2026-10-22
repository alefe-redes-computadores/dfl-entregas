# DFL V111 — R38 | Auditoria de custo, isolamento e observabilidade

Base: R37 aprovada localmente, não publicada. Pré-APK: 155 → **157 suítes**, sempre preservando as antigas.

## Cirurgia implementada

1. API `GET /api/access/readiness`: em vez de disparar até **150 queries de projeção simultâneas**, forma um plano apenas com permissões válidas e executa até **4** em paralelo, no máximo. As consultas raiz permanecem duas (`staff_accounts.limit(31)`, `staff_operation_requests.limit(101)`), sem query nova nem escrita. As projeções seguem `limit(1)`.
2. Telemetria derivada dos próprios snapshots: `readBudget` descreve consultas tentadas, documentos retornados, máximo lógico e concorrência. O Firestore pode cobrar leituras adicionais ou aplicar mínimos por consulta; **não é medição do faturamento real**.
3. `staffReadinessClient` compartilha apenas operações **ainda pendentes** do mesmo proprietário (single-flight), sem cache após resultado, sem storage, sem polling e sem cruzar UIDs.
4. Página premium `/mais/acessos/leituras`, owner-only, sem consulta automática ao abrir; integrações no Gate, Segurança e Prontidão. Relatório sem UID/PII.
5. Gate R37 rejeita amostras com timestamp inválido, futuro ou maior que quinze minutos; não altera os três bloqueios independentes.
6. Duas suítes R38 (limites/client e endpoint sob 30 contas/150 sondagens) e GitHub Action estritamente **manual** com o Emulator demo. Não executa deploy nem habilita flags ou regras.

## Limitações e homologação

- Até 152 consultas tentadas; até 282 documentos retornados no pior caso da amostra, antes dos detalhes de cobrança. Conexões remotas, índices e retries não são cobertos por essa contagem.
- O teto de quatro vale para as sondagens de projeção de **uma execução na instância**; outras instâncias e outros endpoints mantêm suas próprias cargas.
- Sem execução remota do Emulator, CI e Rules ao vivo, não há aprovação de release. A equipe continua suspensa e as quatro flags continuam sem modificação.
- A mudança de concorrência melhora a intensidade do burst, **não reduz necessariamente o número de leituras faturadas** numa consulta individual.
- R27–R38 permanecem locais. Não há commit/push/deploy ou autorização para isso.
