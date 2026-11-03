# DFL Entregas R236 — Assistente premium com favoritos e recentes

**Base exata:** `c0d3bd95e26a12e73e2e59317b28157ce5fa7df5` (R235 publicada sobre a R242). **Escopo:** apenas apresentação e memória local de atalhos.

## Melhorias

1. Contorno luminoso animado em estilo premium, com brilho âmbar/verde que percorre discretamente a borda da Busca 360 e dos cartões contextuais; sem canvas ou renderização pesada.
2. Entrada suave dos cartões com insights reais, sem simular processamento.
3. Placeholders progressivos da busca, interrompidos no foco/digitação, suspensos quando a aba não está visível e desativados em `prefers-reduced-motion`.
4. Favoritos acionáveis e últimos comandos seguros: somente IDs de um catálogo fechado. **Não** persiste buscas livres, IDs de pedido, nomes, endereços nem telefones.
5. Até seis favoritos e quatro recentes, recuperação local tolerante a dados inválidos ou armazenamento indisponível.
6. Busca R234, contexto R235, Radar legado recolhido, R242 receptor de combos, sync e finanças preservados.

## Proteções

- Não altera `firestore.rules`, backend, Firestore, rotas de API, estoque, pagamentos, pedidos, sincronização ou menus nativos.
- Não usa IA remota, microfone ou novas leituras.
- Somente comandos de navegação autorizados entram no histórico; ações operacionais seguem com confirmação pré-existente.
- Instalador verifica base `HEAD`/`origin/main`, estado limpo, blobs exatos, 2 âncoras em preflight, SHA256 do payload, tests R236/R235/R234, `tsc --noEmit`, todas as suítes PRE-APK, allowlist e stage seletivo. Com falha pré-commit, restaura somente os quatro arquivos rastreados e remove os quatro novos.
- **APK não é automaticamente considerado aprovado** pelo push. Confirmar workflow Android e testar.

## Plano após R236

R237: voz opcional (autorização do Android), comandos assistidos com prévia, histórico isolado por conta quando for pertinente e decisão sobre substituir o Radar legado após homologação.
