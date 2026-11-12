# DFL Entregas R57 — microcirurgia de clareza visual

Base publicada auditada: `bde04ba27431f0d34e3844cde4ca5a3a2670504b` (R56).

## Escopo

- **Loja → Confirmações, histórico e apoio:** botões de iFood, Histórico do Site e Preferências 360 com ícones Lucide, descrições curtas, contraste coerente e alvos de toque.
- **Loja → Configurações:** melhor distinção do cabeçalho, acesso à Central e resumo recolhível com ícones, sem duplicar editores.
- **Mais → Acessos técnicos:** Mensageria original e Acompanhamento original com ícones distintos, preservando permissões administrativas.
- **Nenhuma mudança:** rotas, ordens manuais, compras, despesas, clientes, estoque, Firestore, Supabase, WhatsApp, pagamentos, serviço de atualizações e notificações.

## Garantias

- Pré-voo aplica os patches em cópias temporárias e verifica a sintaxe antes de escrever o repositório.
- Instalador exige `main` sincronizada à base publicada e ausência de modificações rastreadas/stage.
- Backup seletivo, verificador R57, R54/R55/R56, TypeScript, ESLint direto e PRE-APK global.
- Falha após aplicação faz rollback apenas dos dois arquivos e exclui os dois arquivos novos.
- Publicação é separada: após aprovação local, o publicador verifica fingerprints e stage seletivo; nunca usa `git add -A`.
- Homologação visual no APK ainda necessária após aprovação técnica.
