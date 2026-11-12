# DFL Entregas — R56 · Acabamento por auditoria do vídeo

Base auditada: GitHub `main` após R54/R55 e o ajuste de mensageria do dia 12/11/2026.

## Evidências visuais observadas

- **1:45–2:20:** na Loja, os atalhos de Clientes, Equipe e Motoboys viraram botões só com texto e uma seta pequena; ícones Lucide reintroduzidos com cores semânticas e legenda curta.
- **2:39–2:51:** Loja usa seis cápsulas para exibir opções de operação e texto como "99Food: pela plataforma"; trocado por painel que responde "quem faz a entrega" e "entra ou não nas rotas DFL", a partir da preferência já persistida.
- **3:06–3:11:** ao focar a Busca 360, aparece um retângulo verde sobre o input. Causa encontrada: regra global `input:focus-visible`, que contrasta com o foco dourado do formulário. Exclusão CSS estritamente na Busca 360; os demais inputs permanecem acessíveis.
- **0:42–1:03:** Mais e Comunicação 360: títulos e explicações técnicas excessivas; microcopy simplificada e cartões ligeiramente menos altos. Autorizações do dono, modos OFF, nav e componentes dinâmicos foram preservados.
- **0:21–0:39:** preferências da plataforma mantêm escolhas existentes; descrições mais claras, sem alteração de backend.

## Arquivos modificados

- `app/globals.css`: regra de foco somente na busca universal.
- `app/loja/page.tsx`: 3 atalhos com Lucide e resumo sem abreviações obscuras.
- `app/mais/preferencias/page.tsx`: ajuda contextual nos modos de entrega.
- `app/mais/comunicacao/page.tsx`: explicações e densidade visual.

## Não modificados

`store/useAppStore.ts`, rotas, entregas, cobranças, estoque, compras, Supabase, Firestore, WhatsApp, bot, atualizador nativo, Motor de Notificações, envio externo, regras de segurança e CI.

## Segurança do pacote

A simulação completa do patch ocorre ANTES de alterar o projeto; se qualquer ponto divergir, o aplicativo permanece intacto. Em seguida há backup seletivo, checagens R54/R55/R56, TS, ESLint direto e PRE-APK global. Havendo falha, rollback R56 e nenhuma publicação. O publicador é separado e requer execução explícita após homologação visual no aparelho.

## Aceite visual

1. Abrir Loja → Pessoas e equipe → três ícones com nomes legíveis.
2. Loja → Configurações → Conferir valores atuais → nomes e consequências explícitos para iFood, 99Food e Keeta.
3. Abrir Busca 360 → focar o texto → contorno de foco dourado apenas no conjunto da busca, sem caixa verde interna.
4. Mais → Comunicação 360 → textos compactos, navegação e proteção mantidas.
5. Mais → Preferências → Plataforma parceira → explicação sem ambiguidade.
6. Repetir com teclado aberto e navegação inferior, verificando safe area, scrolling e retorno.
