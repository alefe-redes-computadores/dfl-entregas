# DFL V111 R23 — Vinculação verificada + projeções mínimas (SEM ATIVAÇÃO)

## O que é entregue
- Tela Mais > Equipe e permissões > Homologar vínculos, para somente o proprietário.
- Endpoint `POST /api/access/staging` (Node/Vercel), protegido por `verifyIdToken(token,true)` + UID do proprietário.
- Verifica `targetUid` no Firebase Authentication via Admin SDK, `emailVerified=true`, usuário não desativado e coincidência EXATA com o e-mail do rascunho; jamais confiar apenas no e-mail digitado.
- Fluxo de 3 etapas: verificar, prévia (sem escrita), preparar (escrita explicitamente confirmada).
- `stage` grava `staff_accounts/{uid}` **status suspended**, não active, e `staff_workspaces/{uid}/{area}/{id}` com campos permitidos.
- Construção de projeções por seleção explícita de campos, sem `...doc.data()` e sem copiar endereços, telefones, valores, pagamentos, custos, observações ou dados de outros motoboys.
- Audit trail na coleção administrativa `staff_access_audit`.
- Cliente API com Bearer Firebase, resposta JSON validada, CORS nativo e timeout.
- Testes comportamentais de whitelist e regressão incorporados ao PRE-APK (141 suites).

## Limitações INTENCIONAIS
- **Nenhum funcionário consegue entrar**: `NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED` continua DESLIGADA e as regras online owner-only NÃO são alteradas.
- R23 requer deployment posterior do endpoint na Vercel para testar a área de homologação de verdade. No APK estático a rota `/api` é isolada da exportação e o cliente nativo chama o servidor Vercel.
- A operação **stage** executa escrita REAL no Firestore caso o endpoint esteja publicado e o superadministrador confirme. Não executa escrita só por instalar código.
- Rotas precisam estar ligadas pelo `motoboy_id` canônico; sem fallback aproximado por nome. Entregas são limitadas às primeiras 4 rotas encontradas, 10 entregas por rota. Itens faltantes NÃO implicam perda na base.
- Projeções de compras não incluem valores nem fornecedor; ainda não há botões de cadastrar/editar/finalizar para funcionários.
- A tela usa UID do Firebase Authentication informado pelo superadmin. Futuramente haverá solicitação de vínculo com confirmação de identidade pela própria conta do convidado.
- O Firebase Emulator e os testes de política R22 **continuam pendentes**. Não publicar a rules candidata R22, nem liberar a flag para os funcionários, só com PRE-APK verde.
- Revogação real, exclusão total de projeções, trilha por operação, expiração/reconciliação, escrita validada via backend e cache segregado por UID precisam de auditoria antes do primeiro funcionário ativo.

## Implantação
- Aplicar R23 no Termux, conferir PRE-APK/TypeScript. NÃO faz commit/push/deploy.
- Validar no PWA a tela, sem usar a ação de preparação em produção antes da homologação do endpoint.
- Na R24, testar Rules com emulador + contas de homologação, definir processo de autorização e limpeza de dados e então considerar ativação controlada.
