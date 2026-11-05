# DFL Entregas — R266: Rota pronta para sair

Escopo: **estado operacional próprio**, diferente de "pedido pronto" e "rota despachada".
Esta versão NÃO atualiza contrato público R249/R265, integração de WhatsApp,
VPS, Finance, Firebase Rules ou flags de ativação.

## Transições
- `aberta` sem despacho e sem prontidão: **Montando**.
- Botão **Marcar rota pronta**: transação Firestore serializada no mesmo documento `routes/{id}`.
- Campos: `departure_ready_at`, `departure_ready_by_uid`, `departure_ready_signature`,
  `departure_ready_count`, `departure_ready_revision`, `departure_ready_revoked_at`,
  `departure_ready_last_confirmed_at`.
- Alterações em composição, ordem, endereço, status, urgência ou motoboy deixam a
  assinatura local divergente e exigem **Reconfirmar** antes do despacho.
- Desfazer a conferência: transação auditada, retorna à montagem, não apaga despacho.
- Despacho continua `started_at`/`departure_time`, com checklist e integrações legadas.
- Pedidos finalizados continuam finalizados individualmente.

## Offline e autoridade
**Fail closed:** Firestore Web SDK não confirma transações offline. Sem conexão,
nenhuma mensagem de sucesso ou prontidão fictícia é mostrada. As entregas e demais
funções offline já existentes continuam intactas. A R266 não promete fila offline
para essa nova aprovação crítica. No retorno à rede, o operador repete a conferência.

A assinatura de conferência é um **checksum de invalidação de UI**, não uma prova
criptográfica nem autorização para mensagens. A R266 não expõe esse campo ao público.
O servidor exige `status=aberta`, ausência de saída real e `updated_at` idêntico
antes de alterar o documento, protegendo concorrência sobre a própria rota.
Alterações simultâneas em documentos individuais de pedidos podem exigir revisão
após o refresh. Antes de tornar a prontidão visível no tracking público, será
necessário um gate adicional com snapshot autoritativo de rota + pedidos.

## Gates / execução
- Base: `main` R255 e R265_LOCAL_APROVADA **sem commit**.
- Backup seletivo dos arquivos antes da aplicação.
- `node scripts/test-r266-route-departure.cjs`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/pre-apk.cjs`
- `git diff --check`; sem stage/push/deploy automáticos.
- R266 só é aceita após todas as verificações; rollback seletivo em qualquer erro.

## Próximo gate
Homologar R265 e R266 em pedido fictício + Firestore real, comparar cliente A/B,
inspecionar R266 offline e concorrência, sem habilitar acompanhamento público.
Emissão link e disponibilização manual seguem exclusivamente o contrato R265.
