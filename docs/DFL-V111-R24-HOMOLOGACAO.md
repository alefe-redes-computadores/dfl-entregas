# DFL V111 R24 — plano de homologação com contas de funcionários

## O que muda
- API POST `/api/access/revoke`: **apenas** owner UID, com `verifyIdToken(token, true)`.
- `inspect`: consulta identidade e versão da conta, sem alterar dados.
- `revoke`: exige conferência prévia, confirmação explícita, versão atual; transação suspende conta e zera permissões antes de qualquer limpeza, solicita revogação de refresh tokens e elimina projeções isoladas por UID.
- Falha parcial: a resposta avisa que a conta já foi suspensa, mas a limpeza/revogação de tokens deve ser repetida.
- Portal: invalida buscas assíncronas com epoch quando recebe evento de mudança de autenticação/permissões, inclusive mudança de metadados offline; consultas usam servidor e nunca `useAppStore` para dados do funcionário.

## O que NÃO muda
- Nenhuma conta é ativada. Não existe rota de ativação.
- O Firestore publicado continua com regra **exclusiva ao owner**.
- Não faz login de funcionário, nem altera credenciais da equipe.
- Não faz migração, commit, push, deploy, nem escrita no banco durante instalação.
- As rotas administrativas, Estoque e Compras preservam os fluxos existentes.

## Teste do emulador (futuro, depois de commit e autorização)
- Arquivo `security/firestore.v111-r24-candidate.rules` é apenas candidato.
- Workflow `.github/workflows/firestore-r24-homologation.yml` é **somente** `workflow_dispatch`.
- Usa projeto `demo-dfl-entregas-r24`, emulador local `127.0.0.1:8086`, sem apontar ao Firebase real.
- Testes: owner, anônimo, motoboy, compras, desconhecido, suspenso, conta alheia, queries sem limite/com limite superior, escrita indevida, revogação com token antigo.
- Só após emulador verde + revisão da separação local/offline + homologaçao com conta de teste fora da produção será possível avaliar publicação das Rules.

## Limites importantes
- Revogar acesso não apaga cópias que um usuário já fez em dispositivo próprio (nem garante remoção física de IndexedDB/arquivos). Por isso, não disponibilizar dados sensíveis aos funcionários.
- A R24 não implementa ações de escrita de funcionários (criar/finalizar entrega, movimentar estoque): elas continuam bloqueadas.
- O token da sessão pode continuar existindo até expirar; a checagem de `status='active'` nas Rules é o bloqueio principal de novas leituras.
- Não habilitar `NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED` antes de todas as etapas, pois o ambiente web e o Android exigem homologação separada.
