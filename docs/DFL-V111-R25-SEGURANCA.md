# DFL Entregas V111 — R25: isolamento de navegador e acesso offline

## Limite de segurança

A R25 **não** libera motoboys ou compradores. O Firestore em produção continua exclusivamente para o superadministrador. O portal só pode renderizar com os três controles simultaneamente:

1. `NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED=true` (inexistente por padrão);
2. `NEXT_PUBLIC_DFL_STAFF_ORIGIN=https://<dominio-exclusivo-dos-funcionarios>`;
3. `NEXT_PUBLIC_DFL_OWNER_ORIGIN=https://<dominio-exclusivo-da-administracao>`, diferente do domínio staff.

As variáveis são `NEXT_PUBLIC_` e entram no *build*. Não configurá-las nem modificar domínio manualmente antes da homologação. O aplicativo nativo Android permanece restrito ao owner.

## Separação offline

- No domínio exclusivo de funcionários, o Firebase usa `memoryLocalCache()` em vez do cache IndexedDB persistente.
- A origem administrativa preserva seu cache IndexedDB e fila offline existentes; a R25 **não apaga nem migra** operações pendentes.
- Portal descarta linhas e permissões exibidas quando recebe o evento `offline`, e exige nova resposta da nuvem no retorno à conexão.
- `getDocsFromServer` permanece obrigatório; não mostrar permissões recuperadas somente do cache.
- Não existe garantia de apagar dados já fotografados, exportados ou salvos em outro dispositivo. Não inserir dados pessoais/financeiros nas projeções.

## Homologação antes de qualquer acesso real

1. Publicar R21–R25 no repositório em pacote aprovado, depois validar Vercel e APK.
2. Executar manualmente a Action `DFL R24 - Testar regras no emulador` usando projeto demo e verificar resultados, **sem credenciais reais**.
3. Revisar de fato o esquema das projeções `staff_workspaces`, filtros por motoboy, e todas as APIs com Firebase Admin SDK; não presumir que o PR é suficiente.
4. Preparar domínios HTTPS separados, sem compartilhar Service Workers nem IndexedDB. Testar origem indevida, usuário desconhecido, conta suspensa e desconexão.
5. Revisar e publicar regras Firebase candidatas **manualmente**, depois de prova no emulador e autorização expressa. Fazer a liberação de uma conta de teste, não de funcionários reais, e monitorar logs.
6. Antes de funcionários finalizarem entregas ou alterarem estoque, é necessária implementação de **APIs de mutação autorizadas**. R25 mantém o portal em modo consulta.

## NÃO implementado

Sem ação de ativação, deploy de rules, exclusão de dados locais, login real de funcionário liberado, nem API de escrita para rotas, entregas e estoque.
