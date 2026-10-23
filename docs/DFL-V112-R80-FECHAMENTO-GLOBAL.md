# DFL ENTREGAS V112 R80 — Finalização de release

Base estrita: R79-R2 `69ed89f05ebe9218da1b4b84172af126f1327b03`. Reúne as cirurgias R75–R80 publicadas na mesma `main`, sem replicar patches antigos ou reescrever dados históricos.

## Novas funções reais
- **Ir primeiro / Deixar por último:** no card expandido, somente em rota aberta e parada pendente, com limite, bloqueio e grupo; usam `moveStop` > `moveDeliveryToIndex` > `setDeliveryOrder` > `keepPinnedStopPositions`, não uma segunda implementação.
- **Rotas Maps e Waze:** prévia sob toque na criação, edição e card oferece abertura do trajeto no aplicativo escolhido por URL oficial. Endereço textual ou latitude/longitude do link reconhecido, nunca estimativa de porcentagem. Nenhum GPS contínuo ou geocoding novo.

## Segurança e experiência
- Rejeita URLs de mapas fora de domínios reconhecidos como evidência de coordenada exata. Links curtos Google Maps ficam classificados como referência sem coordenadas localmente confirmadas.
- Navegação externa usa URLs de destino construídos pelo DFL, não redirecionamento automático para URL arbitrária de usuário.
- Nome de cliente e valores grandes podem quebrar linha sem atravessar o card; relatórios de duas colunas preservam números legíveis.
- Indicador transitório de conclusão na rota enquanto o Firestore confirma fechamento. **Nunca diz "rota encerrada" antes do servidor.**
- BottomNav usa `useMemo` para deduplicação/contagem da Caixa de Entrada e não recalcula quando só estados locais de interação mudam.
- Tela Mais corrige nome/e-mail longos em Android estreito.

## Gate técnico e publicação
- Base, branch, origin/main e commits R75–R79 protegidos.
- Backup tar dos arquivos rastreados em escopo; rollback seletivo antes de commit.
- Testes R80 e regressões críticas R79/R78/R77/R76/V103/rotas/estoque/notificações; TypeScript completo `--noEmit`; PRE-APK completo; staged paths estritamente iguais ao manifesto; `git diff --check`.
- Commit único e push main só após tudo verde, verificação da SHA remota. Arquivos `.orig`, backups e trabalhos fora do manifesto continuam locais.
- R75–R79 já estão publicados na main: não existem "cirurgias anteriores" para reaplicar. Validação do histórico remoto antes da publicação.

## Próximos candidatos avaliados e propositalmente não ativados nesta cirurgia
- Foto/assinatura como comprovante: exigem contrato de armazenamento, permissões, privacidade e sincronização; não devem ser simuladas.
- GPS de entrega em tempo real: exige consentimento, permissões em segundo plano e gestão de privacidade.
- Reentrega com motivo persistido: exige estado operacional e fluxo de acompanhamento próprio; neste release há apenas *Deixar por último*, sem falsificar tentativa de entrega.

## Referências funcionais (não equivalência de recursos)
- Google Maps URLs e Waze Deep Links: https://developers.google.com/maps/documentation/urls/get-started ; https://developers.google.com/waze/deeplinks
- Routific (operação por paradas, alterar ordem, nova tentativa): https://help.routific.com/en/articles/16-using-the-routific-mobile-app
- Onfleet (comprovante/timeline como produto futuro): https://support.onfleet.com/hc/en-us/articles/10348848090644-Proof-of-Delivery
