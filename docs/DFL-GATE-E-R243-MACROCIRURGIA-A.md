# DFL Entregas — Gate E / Macrocirurgia A · R243

## Base e segurança

- Base única: `343df496a817cab83cd09b08a37c873c2be402eb` (main R237).
- A R242 já impede o recebimento produtivo de V3 e preserva V1/V2; **ela não é removida nem relaxada**.
- O Site R249-R2 continua com `COMBO_V3_*_ENABLED=false`.
- **Não implementa persistência Firestore V3**, API de V3, impressão física, pagamento ou mensagens. Esta etapa cria um ensaio tipado do contrato candidato R249 e UI de diagnóstico/admin, sempre OFF.

## O que esta macrocirurgia entrega

1. Validador fail-closed do **candidato** `dfl_site_combo_order_v3_candidate` (Site R249). Exige `certification_only`, IDs reais nulos e todas as autorizações negativas. Rejeita chaves extras em todas as camadas para impedir perda silenciosa.
2. Reconciliação de cada unidade, composição de combo, adicionais/removíveis, quantidades, notas e centavos. Detecta alteração de preço, duplicidade, lacuna de unidade, divergência de composição e tentativa de ativação.
3. Renderizador puro de **bobina simulada** 58/80 mm. Mantém unidades separadas, bebida quando informada como componente, adicionais, remoções e observações de até 140 caracteres; quebras sem truncar caracteres, inclusive emoji.
4. Laboratório de visualização no **Mais → Diagnóstico local** (somente admin existente), recolhido por padrão, com fixture sintética: 2 combos, 6 unidades, Uai/Bacon/SEM Cebola/Kuat 2 L, observação longa e prévias sem saída de impressão.
5. Suíte dedicada no PRE-APK, preservando as 299 existentes. Testes adversariais, simulação de importação não autorizada e conferência de isolamento do endpoint/Firestore.

## O que continua bloqueado no Gate E

- Contrato V3 recebido comercialmente; persistência do snapshot por unidade no Firestore e tratamento de reconexão/idempotência V3 em ambiente real.
- Regras para bebidas e outros itens comerciais em payloads reais do Site (o laboratório testa uma bebida como componente **sintético**, não garante que o produtor emitirá essa estrutura).
- Integração da visualização V3 nas telas de pedidos/rotas reais, que requer dados persistidos e gate previamente homologado.
- Impressão física 58/80 mm; os exemplos não enviam comando à impressora.
- Política de capacidade, previsão, fiado, finance, mensageria e Busca 360 R238 permanecem fora desta macrocirurgia.

## Testes e evidência

- `node scripts/test-r243-site-combo-v3-certification.cjs`
- `node scripts/test-r242-site-combo-receiver.cjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node scripts/pre-apk.cjs` (agora 300 suítes, se a lista não tiver mudado)
- `git diff --check`

Instalador da R243 usa SHA exato, preflight, allowlist, backup seletivo e rollback. Não roda `npm run build` no Termux. Não faz git add, commit, push, Vercel, Firestore ou WhatsApp.

**Decisão:** Macrocirurgia A1 pode passar em testes locais, mas **Gate E continua BLOQUEADO** até completar o receptor produtivo de forma conjunta com o Site, certificar transações, formato real de combos, impressoras reais e demais critérios do Gate E.
