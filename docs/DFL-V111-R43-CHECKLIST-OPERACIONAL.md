# DFL Entregas R43 — Prontidão para teste com equipe e operação global

**Estado ao instalar:** local, proprietário somente; Rules de produção NÃO alteradas; nenhum acesso de funcionário liberado.

## Preparar convite
- Motoboy: escolher perfil Motoboy e vincular ao cadastro real de entregador.
- Compras: selecionar perfil Compras; não é necessário vínculo com motoboy.
- Operação: consultar projeções limitadas de logística e Loja, sem acessar financeiro.
- Personalizado: se qualquer permissão logística estiver marcada, o formulário mostra o vínculo obrigatório de motoboy. Se faltar, o pedido pelo Google é rejeitado até correção do rascunho.
- Homologação exige que o usuário do Firebase Auth tenha provedora Google, e-mail verificado e identidade idêntica ao convite. Verificação nunca ativa conta.

## Fluxo futuro do teste real
1. Preparar convite no aparelho do proprietário; revisar prévia de acesso e e-mail Google.
2. Publicar somente após autorização explícita do proprietário; selecionar domínio HTTPS isolado e validar portas desativadas.
3. Executar a Action **DFL R43 - Matriz de acessos (Emulator DEMO)** manualmente após os arquivos serem publicados no repositório. Não executa automaticamente.
4. Conferir Emulator: proprietário, Motoboy, Compras, Operação, Personalizado, sem vínculo e suspenso, com leitura e escrita negadas fora do escopo.
5. Fazer homologação com uma conta Google real e consentimento da pessoa, primeiro sem escrita, sem utilizar dados de produção até as regras serem aprovadas.
6. Publicar Rules em separado, com backup/revisão de regras anteriores e rollback preparado; só habilitar flags/autorização por etapa após homologação e autorização expressa.

A instalação R43 **não executa nenhum dos passos 2–6**. A Action não atesta homologação até ser executada.

## Performance sem alteração de autoridade
- Rotas: contadores montando/na rua/prontas/finalizadas em uma passagem sobre as rotas do dia; cards e estados preservados.
- Entregas: contadores de pendente/concluído/cancelado e atenção em uma passagem. Concluído não significa pagamento recebido.
- Loja: feriados externos agora usam cache efêmero de seis horas e uma única requisição simultânea por ano; timeout 9s e falha não bloqueia operação. Não há nova leitura Firestore.
- Equipe: contagem de pessoas em escala memorizada; não afeta cadastro ou histórico.
- Portal: respostas de solicitações atrasadas não reaparecem depois de revogação de acesso.

## Publicação
Proibido inferir sucesso de Emulator, TypeScript real do Termux ou Rule deploy a partir do ZIP. Não fazer push, deploy, editar flags ou ativar contas sem autorização.
