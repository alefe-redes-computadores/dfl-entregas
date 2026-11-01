# R232 — Homologação física de fechamento / DFL Entregas

**Usar dados de teste identificados ou pedidos reais previamente escolhidos, sem fazer baixa financeira acidental.** Registrar data/hora, aparelho, commit, comportamento esperado/observado e prints sem dados pessoais.

## GitHub Action Android (gate obrigatório)

1. Abrir `https://github.com/alefe-redes-computadores/dfl-entregas/actions/workflows/main.yml`.
2. Confirmar execução `Build Android APK DFL Entregas` para o **SHA exato da R232 publicada** (não confundir com builds anteriores).
3. Verificar jobs verdes em `TypeScript`, `PRE-APK`, export Next, Capacitor, permissões de GPS, System Bars, ponte Admin, ícones, `assembleDebug`, `apksigner`, upload de artefato.
4. Baixar artefato `DFL-Entregas-<run>-<sha>`; conferir assinatura estável e instalação sem desinstalar dados sem backup.
5. A ausência de Action verde, artifact ou assinatura idêntica = **BLOQUEIO DE HOMOLOGAÇÃO**.

## Dois aparelhos (PWA e/ou APK)

| Cenário | Resultado esperado | Evidência |
|---|---|---|
| Criar duas entregas manuais em sequência | IDs diferentes, sem substituir outro pedido | Abrir ambos os detalhes |
| Criar múltiplos pedidos mesmo endereço | Mesma parada física, links/valores por pedido | Lista e WhatsApp |
| iFood ID invertido no texto | Parser reconhece ID, não cria duplicado | Conferência no formulário |
| 99Food seis dígitos | Origem amarela e sem exigência de rota/confirm. indevida | Formulário + card |
| Site gera pedido | Pedido fica na Caixa de Entrada até alocar manualmente | Captura após criar |
| Site cancelado | Sem baixa, edição, rota ou faturamento operacional | Caixa/histórico |
| Reordenar com setas | UI muda rapidamente, confirma remotamente, mantém pin | Ordem nos dois aparelhos |
| Travar parada com vários pedidos | Feedback por pedido, sem confusão com confirmação parcial | Cards e detalhe |
| Arrastar para dar baixa/desfazer | Mesmo resultado dos botões, sem falsa baixa por rolagem | Histórico da parada |
| Editar compra e esconder teclado | Produto selecionável e dados mantidos | Compras mobile |
| Sugerir tomate/ovo/salsicha | Mínimo configurado e unidade não geram sugestões absurdas | Estoque com valores conhecidos |
| Sem internet e reconexão | Não afirma sucesso de estoque/financeiro, diário mostra pendências | Banner + Diagnóstico |
| Reiniciar com operação não confirmada | Solicita conferência, sem replay automático | Diagnóstico |
| Abrir PWA atualizado com compra suja | Não recarrega até sair/salvar com segurança | Simular atualização controlada |
| Conta staff/owner | Menus e dados de cada papel respeitam permissões | Somente perfis homologados |
| Home e Caixa móvel | Cards não se sobrepõem nem ficam sob teclado/bottom nav | Fotos dos dois dispositivos |

## Critérios de aceite final

- Gate Termux completo aprovado e commit/HEAD do GitHub idênticos.
- Action Android para o mesmo HEAD: sucesso com APK validado e artifact acessível.
- Dois aparelhos: fluxo Site→Inbox→rota, cadastro, baixa/desfazer, compra/estoque e reconexão conferidos.
- Revisão de rules publicadas continua **separada**; este pacote não altera nem certifica Firebase Rules.
- Qualquer falha funcional = registrar reprodução e corrigir seletivamente antes de declarar operacional.


### Evidência de compatibilidade R232-R2

O gate estático valida a alocação explícita usando o alias `allocate` do componente e a ação transacional `allocateSiteDelivery` do store. A confirmação funcional ainda exige o teste real Site → Caixa de Entrada → rota com um pedido de homologação autorizado, sem introduzir pedidos fictícios em produção.
