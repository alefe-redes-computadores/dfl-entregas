# V111 R63 — Equipe e Permissões: operação, solicitação e segurança

## Situação real

A R63 NÃO ativa funcionários. O cadastro dos perfis Motoboy, Compras, Operação e Personalizado continua em preparação, e a produção permanece com Firestore Rules owner-only e flags desligadas. Nenhuma execução real do Firebase Emulator ou validação em um segundo dispositivo é afirmada por este pacote.

## O que ficou consistente

- Motoboy: propostas apenas para entregas atribuídas ao motoboy vinculado e publicadas na projeção do UID.
- Compras: pode solicitar lançamento de compra, nunca altera saldo diretamente.
- Operação: pode propor conferência de entrega de rota ativa **sem vínculo de motoboy individual**, desde que tenha `deliveries_read` e `deliveries_complete` e o pedido esteja publicado na projeção individual. O backend lê documento canônico de entrega e rota na transação, rejeita cancelados, pendentes do Site, retiradas e entregas concluídas.
- Personalizado: continua exigindo vínculo individual para logística.
- Resposta incerta (timeout): cliente reutiliza requestId por até 15 minutos para a mesma identidade, pedido, tipo e quantidade; backend continua com idempotência transacional. Isso não é deduplicação permanente entre dispositivos.
- Pedidos cancelados pelo Site aparecem como **Cancelada** na projeção e não oferecem botão de solicitação.
- A tela bloqueia dois acionamentos dentro do mesmo frame e exige confirmação explícita.

## Pendências para acesso real

1. Executar as Actions do Firebase Emulator isolado e revisar os logs dos quatro perfis; as regras de produção não são as candidatas do repositório.
2. Verificar a implantação de domínio isolado, login real de uma segunda conta, vínculos Google, identidade, sessão, offline, revogação, permissões cruzadas e consulta em múltiplos dispositivos.
3. Revisar, autorizar e publicar o código de forma seletiva. Só com autorização explícita do proprietário alterar regras e flags, com plano de reversão e conta piloto.
4. Confirmar visualmente no APK/PWA os fluxos e revisar custos de leituras.

## Regras de segurança

Sem permissões financeiras, sem acesso às coleções administrativas por funcionários, sem escrita direta pelo cliente e sem mudança de flags, migração, Rules, deploy ou publicação.
