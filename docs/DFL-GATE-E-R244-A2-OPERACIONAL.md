# DFL Entregas — Gate E R244 A2 | Separação operacional e bobinas de Combo V3

Base: `343df496a817cab83cd09b08a37c873c2be402eb` (GitHub R237) **com R243 A1 aplicada, não publicada**, como relatado pelo operador. Pré-apk anterior: 300 suítes.

## Entrega incremental

- Cenário sintético: dois códigos de pedido distintos para dois clientes diferentes que compartilham exatamente o mesmo endereço.
- Um card por código, uma prévia de mensagem por pedido e bobinas individuais 58 mm/80 mm, sem mistura de unidades.
- Mantém cada unidade, adicional, remoção, observação extensa, bebida e os totais exclusivamente demonstrativos do documento R249.
- Ensaio legível no diagnóstico de administrador, embaixo do laboratório R243.
- Sem botão de impressão, sem comando de WhatsApp, sem rota nova, sem chamada de API e sem Firestore.
- Testes adversariais R244 anexados ao PRE-APK. Pré-APK esperado: 301 suítes.

## Limites reais

A R244 é **uma preparação operacional, NÃO a homologação da entrega V3**. Não altera `lib/integration/site-order.ts`, `siteOrderPersistence.ts`, API, regras, outbox, impressoras nativas, painel de rotas ou Caixa de Entrada. A proteção R242 continua rejeitando schema V3 em produção.

A implantação real ainda requer contrato comercial assinado com evento versionado, persistência transacional imutável das unidades, apresentação efetiva nas páginas de pedidos/rotas, testes 58/80 em impressoras físicas e autorização explícita de release conjunto com o Site. Não declarar Gate E aprovado.

## Contratos de segurança do instalador

- Bloqueia se HEAD/branch/remoto divergirem ou se alterações locais não forem apenas as esperadas da R243.
- Verifica SHA-256 da R243 instalada e do novo payload.
- Preflight das âncoras antes da primeira gravação; backup dos dois arquivos preexistentes que serão alterados.
- Nunca executa `git add`, commit, push, deploy, `npm run build`, alterações Firestore, Rules ou WhatsApp.
- TypeScript completo, R243, R242, R244, PRE-APK integral, `git diff --check` e allowlist final.
- Rollback somente dos dois arquivos modificados e dos novos arquivos R244; R243 permanece intocada em falhas.
