# DFL Entregas — R228-R4: fechamento das três suítes legadas

## Base

Aplica R228 + R2 + R3 + R4 a partir da `main` R227 (`5b34fc4ff5bc78c46e747688f100e342ee018dcc`), somente com working tree limpa. **Não reaplicar pacotes R228 antigos separadamente.**

## Correção dos 3 bloqueios do PRE-APK

- **R221 — portal do RouteAccordion**: mantido `import { createPortal } from 'react-dom';` para preservar o contrato de modais e importado `flushSync` separadamente. A animação com View Transition continua presente.
- **R220 — card responsivo e financeiro**: a suite passa a verificar a largura flexível de `Dar baixa`, em vez de classes obsoletas; mantém acessibilidade, ordem dos atalhos, proteções contra duplo toque e diferenciação de conclusão física e pagamento.
- **R55 — evento de pedido Site**: o cenário de teste passa a prover timestamp válido e metadados de cache, e injeta o **módulo real** de política de alerta. Inclui testes para pedido antigo, cache e timestamp inválido: badge continua atualizando, alerta não repete.

A R4 não modifica regras Firebase, esquemas, autenticação, pedidos, saldos ou lógica de persistência. Todos os testes antigos continuam no PRE-APK. É uma compatibilização testada, não desativação de validações.

## Toda a cirurgia reaplicada

R228 notificações, estoque conservador, compra e fluidez; R2 roteamento automático inteligente, cards responsivos e parser TS/TSX; R3 parser iFood invertido, status da Home e telemetria por etapa; R4 reconciliação dos contratos legados.

## Segurança

Backup externo em Downloads; manifesto SHA256; HEAD remoto/local verificados; âncoras estritas; TypeScript integral; PRE-APK integral; `git diff --check`; allowlist; commit/push seletivo só após aprovação; rollback antes do commit; em caso de commit/push, preservação sem reset destrutivo.

Se houver outra falha, conferir `resultado.txt` no diretório indicado. Não retirar suites nem criar falsa confirmação no aplicativo.
