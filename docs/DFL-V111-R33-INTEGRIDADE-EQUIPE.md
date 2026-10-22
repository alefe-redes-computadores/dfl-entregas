# DFL Entregas V111 — R33 | Auditoria profunda de projeções

## O que mudou
- R32: mantém painel de prontidão com amostra de um documento por área.
- R33: ação **Auditar projeções** de cada conta do painel, com tela premium dedicada.
- Endpoint GET `/api/access/integrity?uid=...`, `Firebase Auth.verifyIdToken(token,true)` e UID exclusivo do proprietário.
- Regras Firestore de produção NÃO mudam; Admin SDK executa a inspeção somente com conta owner e sem mutações.
- Até **12 documentos por área** de um único funcionário, obtidos sob demanda, com marca de amostra parcial.
- Confere campos indevidos/padrões sensíveis, áreas incompatíveis com o perfil e divergências da projeção com a fonte.
- Para motoboys, compara ID do motoboy da conta com a atribuição da rota original, inclusive a rota de cada entrega projetada.
- Usa cache de leituras por documento original para evitar consultas duplicadas; limite explícito de 75 leituras-fonte por execução.
- Dados da fonte (telefone, preço, endereço, histórico) **não retornam para a interface**. Somente contagens e tipos de risco.
- Visual dark premium: cards compactos, indicadores, estados vazios, feedback tátil para atualização e toasts de erro/sucesso.

## Riscos e limites conhecidos
- Inspeção **amostral**; registros além dos primeiros 12 documentos de cada área não são examinados. A ordenação dos resultados não é garantida. Não representa cobertura integral.
- Resumo Home é derivado, sem documento-fonte individual para comparar.
- Se as projeções foram preparadas há dias, a origem pode ter sido alterada legitimamente; divergência requer revisão antes de reprojetar.
- Um documento com texto fora da whitelist é sinalizado, nunca exibido ao funcionário.
- Exige disponibilidade do Firebase Admin no backend e não deve ser usado como prova de que regras de produção estão publicadas.
- Não ativa contas, não modifica estoque, não marca entregas como concluídas, não altera permissões ou status.
- Regras de produção seguem OWNER-ONLY. Não modificar flags de staff e não ativar funcionários.

## Testes e publicação
- R33 adiciona suíte de contratos ao PRE-APK (151 previstas).
- Instalação local com backup, hash exato dos dois arquivos substituídos e rollback.
- Nenhum commit, push ou deploy. Posterior revisão seletiva para release.
