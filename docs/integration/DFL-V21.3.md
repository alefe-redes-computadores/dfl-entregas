# DFL V21.3 — Worker reverso econômico

O reconciliador deixa de ler as coleções completas de `deliveries` e `routes`
em todo ciclo.

Agora:
- consulta inicialmente apenas deliveries com `source_system == dfl_site`;
- lê somente as rotas realmente referenciadas por essas deliveries;
- lê deliveries somente dessas rotas para preservar posição por parada física;
- mantém event_id determinístico;
- substitui uma transação por candidato por leitura direta + `create()` atômico;
- mantém a semântica V21.2: posição/nextStop só depois de início real da rota.

A mudança reduz leituras/transações recorrentes sem mudar ownership ou contrato
dos eventos.
