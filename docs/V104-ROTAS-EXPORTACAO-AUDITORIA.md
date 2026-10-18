# V104 — Relatório de desempenho por rota e compartilhamento seguro

## Mudanças implementadas

- Imagem compacta de prestação de contas por rota com identidade visual DFL.
- Mostra pedidos, paradas físicas completas, duração comprovada e ganho quando a regra é por entrega.
- Regra fixa/híbrida: não inventa rateio. Orienta consultar o acerto diário.
- O resumo de rotas usa dados memorizados, sem leituras adicionais do Firestore.
- Proteção contra toques simultâneos, modo de privacidade e falsos positivos de compartilhamento.
- No navegador, a imagem é baixada; no Android, abre-se o seletor de compartilhamento.

## Riscos e limites

- O comprovante é informativo e não comprova liquidação financeira.
- Entrega do arquivo ao destinatário depende do aplicativo escolhido pelo usuário.
- O envio automático de WhatsApp do DFL Site/VPS continua uma investigação separada; a V104 não faz reenvio.
- O encerramento automático da rota aguarda autoridade Firestore; não remover validação para disfarçar latência.

## Regressões

A alteração é de apresentação e cálculos locais; sem novas subscriptions ou consultas remotas.
Validar em Android o compartilhamento nativo, o modo privacidade e o comportamento sem regra configurada.
