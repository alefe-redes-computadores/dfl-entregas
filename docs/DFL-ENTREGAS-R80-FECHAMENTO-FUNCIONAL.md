# DFL Entregas — R80 | Fechamento funcional pós-Premium360

**Data:** 17/11/2026. **Pré-requisito:** R78 e R79 publicadas na `main`, R79 Vercel READY. O pacote não é para aplicar antes da publicação da R79. Nenhuma publicação é automática.

## Evidência revisada

- Vídeo original `1002630727.mp4` (4m13s), auditoria quadro a quadro e relatório mestre DFL 360 de 17/11/2026.
- Código GitHub R78 e pacote de correção R79 FIX4.
- Relatos de confirmação iFood que não avança/baixa, endereços e telefones de clientes com alternativas, cozinha, WhatsApp, fixação, navegação e visual Premium 360.
- O vídeo demonstra principalmente organização e navegação. O comportamento remoto de iFood e entrega real de WhatsApp **não é observável integralmente** na gravação.

## Mudanças de produção — verificáveis

1. **iFood: botão sobreposto ao iframe.** `app/confirmar/page.tsx` usa um iframe com `position: absolute; inset:0` dentro da mesma área onde ficam os botões de resultado. O iframe pode cobrir a ação *Funcionou · próximo* e a ação de código errado. R80 substitui pelo layout de coluna com barra de confirmação acima e iframe flexível somente no espaço restante; mantém o domínio oficial, a navegação assistida e a confirmação **exclusivamente após ação do operador**.
2. **iFood: feedback de gravação.** O CTA exibe `Registrando...` enquanto o DFL tenta dar baixa e resolver a pendência, com bloqueio síncrono do duplo toque. Erro mostra causa capturada; se falhar, não navega como se estivesse confirmado.
3. **Múltiplos endereços/telefones.** Em `CustomerDestinationSheet`, quando há mais de um telefone ou endereço, começa sem escolha. O operador precisa tocar em uma opção, e o botão de uso fica desabilitado até a seleção. Retirada (`pickup`) não exige endereço de entrega. A seleção não altera automaticamente o endereço padrão do cliente.
4. **Cliente iFood incompatível.** Em Nova/Editar, caso o endereço/nome escolhido não corresponda ao pedido iFood, o formulário mantém a folha de seleção aberta e informa o bloqueio, permitindo tentar outra opção sem perder o contexto. Pedido de loja mantém a escolha explícita e destino temporário separado.
5. **Gate de prevenção de regressão.** Novo teste hermético incluído no PRE-APK; preserva R76 cozinha, R78 fixação, R79 apresentação, pagamento e permissões. Não altera Firestore Rules, Supabase, Site, Finance, pedidos existentes ou envio de mensagens.

## O que a cirurgia NÃO afirma ter homologado

- **Portal iFood:** domínio de terceiro. Não lê automaticamente campos internos nem detecta, por si só, que a confirmação externa funcionou. O operador deve confirmar o sucesso no portal e tocar *Funcionou · próximo*; depois o DFL persiste a baixa pela store.
- **Mensageria 360:** `queued`/aceito não comprova WhatsApp entregue. Um pedido real consentido precisa produzir recibos do provedor para `order.production` e `order.ready`. Em falha incerta, revisão sem reenvio cego; sem novos eventos retroativos.
- **R78/R79 no Android:** persistência de rolagem, rotas fixadas e acabamento visual requer inspeção após deployment. Testes herméticos não substituem o aparelho.
- **Integrações externas iFood/99Food/Keeta:** não cria nova API, automação de portal nem confirmação financeira. A Central Electron/Windows é outra frente.

## Aceite final sugerido — rápido e real

1. **Duas pendências iFood elegíveis:** abrir portal, confirmar uma, tocar *Funcionou · próximo*; deve dar baixa no pedido vinculado e mostrar o próximo código, sem segunda baixa manual e sem botão coberto pelo iframe. Voltar à Central e conferir status/contagem.
2. **Código iFood inválido:** tocar *Código errado*; não concluir a entrega, sinalizar revisão e avançar apenas o item atual. Testar duplo toque e falha de rede sem duplicar gravação.
3. **Cliente com dois endereços e dois telefones:** selecionar manualmente ambos; botão desabilitado antes da escolha, preencher endereço/telefone escolhidos, Maps correto; voltar sem que outro cliente ou endereço seja inferido. Testar Nova e Editar. Endereço temporário não altera o cadastro.
4. **Identidade iFood divergente:** escolher endereço/nome incompatível; seleção deve permanecer aberta com aviso e sem sobrescrever pedido.
5. **Cozinha:** em pedido manual DFL consentido, marcar `Em produção`, depois `Pronto`; checar Site/Mensageria e recibo de provedor, sem conflitar com `Saiu para entrega` e `Concluído`. Não enviar mensagens a pedidos testes ou sem opt-in.
6. **Rotas:** fixar multipedido, reorganizar manual/inteligente, sincronizar, sair/voltar; parada fica onde estava até **Desfixar**. Conferir filtros de motoboy e simulação de acerto sem lançar financeiro.
7. **Vídeo visual:** Home, Loja, Clientes, Equipe/Motoboys, Compras, Estoque, Despesas, Preferências, Mais/Comunicação, Caixa de Entrada e Histórico; verificar scroll, retorno, teclado, toasts, ícones e densidade visual com R78/R79 aplicadas.

## Segurança do pacote

- Pré-voo: R79 publicada como commit filho da R78, main local/remota iguais, alvos sem alterações; 5 arquivos preexistentes e 2 novos.
- Ancoragem de código com validação de todas as ocorrências **antes da escrita**; backup seletivo dos 5 arquivos.
- Regressões R76/R78/R79, teste R80, `tsc --noEmit`, PRE-APK global, `git diff --check`.
- Rollback seletivo em falha; aprovação local **não** realiza commit nem push. Publicação em comando separado com staging de caminhos explícitos, nunca `git add -A`.
