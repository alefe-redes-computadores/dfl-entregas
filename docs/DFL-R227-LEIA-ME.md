# DFL Entregas — R227 (hotfix de latência, com operação em andamento)

**Base exata:** `0bba410f0b8bfef5edabce4b718fbe3b7feebaaf` (R226 publicada).

## Motivo
A tela de Nova Entrega fazia chamadas Geoapify/Google *antes* de salvar, e depois aguardava Firebase de cliente e entrega separadamente. A loja relatou aproximadamente 9 segundos por cadastro em rede Wi-Fi rápida. Há caminhos similares com `await` em outras confirmações. Não há prova de que todo esse atraso venha do Wi-Fi.

## Mudanças
1. Nova Entrega gera um link seguro de **pesquisa pelo endereço informado** para Maps sem chamada externa obrigatória. Link digitado pelo operador continua com precedência; o app não inventa coordenadas. O endereço continua sujeito à análise de qualidade prévia.
2. Clientes reutilizados são gravados no Firestore **apenas quando houver enriquecimento real**, eliminando atualizações vazias de `updated_at`. Identidade do cliente e casos temporários continuam revalidados.
3. Central de Diagnóstico passa a distinguir tempo total do cadastro, tempo de vínculo com cliente, gravação confirmada do pedido, lote de pedidos iFood, criação de rota, auto-organização, edição/finalização de compra e integração crítica de estoque. Sem nome, CPF, telefone, coordenadas, endereço ou ID nos registros.
4. Criação e baixa críticas **continuam aguardando confirmação do backend**. Fila R93, proteção R94, autoridade R95, integração transacional e guardas anti-duplicidade não são relaxados. O status `confirmado` é registrado somente após resposta do servidor. O início da rota não foi alterado.
5. Novos contratos R227 e 284+ suítes do pré-APK; TypeScript e rollback seletivo.

## Durante a operação
- Não precisa limpar dados, cache ou desinstalar o APK.
- A R227 não implementa promessa de conclusão offline instantânea nem altera Firestore Rules. O novo link Maps é uma pesquisa textual, não uma geocodificação precisa.
- A latência de **novo cliente + novo pedido** ainda pode incluir dois commits consecutivos no Firestore. Não foi substituída a identidade conservadora por cadastro otimista vulnerável a duplicação.
- O objetivo deste hotfix é remover uma espera externa variável e evitar round-trips desnecessários, medindo as etapas que faltam.
- Acompanhar `Mais > Diagnóstico > Tempos das confirmações operacionais` depois de operações reais.

## Rollback
Backups completos dos arquivos afetados em Downloads, SHA de origem verificado, `git diff --check`, `tsc --noEmit`, `node scripts/pre-apk.cjs`, `git add --` exato e `git push` sem force. Qualquer falha de aplicação ou teste impede publicação e restaura somente os arquivos desta cirurgia. Se o push já tiver ocorrido, preservar o estado e conferir o remoto, sem reset automático.
