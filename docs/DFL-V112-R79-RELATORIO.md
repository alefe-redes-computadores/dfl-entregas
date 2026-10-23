# DFL V112 R79 — Evolução operacional e mapa sob demanda

Base exclusiva `145e143d` (R78-R2). Não modifica esquema Firestore nem migra dados.

- Criação/edição e card compacto: prévia do Google Maps acionada sob demanda. Iframe não carrega no scroll da Home; evita dezenas de mapas simultâneos.
- Classificação de localização por evidência: coordenadas em link, link sem coordenadas, endereço numerado e aproximado. Não atribuir falsos percentuais de acerto. Pin ainda precisa de verificação humana.
- Minimap corrige retorno condicional antes de useMemo, impedindo variação da ordem dos hooks.
- Radar da Home deixa de ocupar espaço com insights positivos/informativos; alertas e atenções reais permanecem. Inteligência completa continua em relatórios.
- Acesso direto às preferências de notificações na Loja; interruptores independentes para lembretes e fechamento; tela informa permissões e comportamentos suportados, sem ações falsas ou auto-permissão.
- Relatórios: títulos responsivos e área de gráfico limitada no Android sem reduzir indevidamente o valor.
- Não tocar no motor de rota/código iFood: testes garantem setas/arraste, agrupamento, travas, rota Site, último concluído no fim, modalidades iFood/99Food e opt-in de confirmação no motoboy. Fechamento remoto não pode ser antecipado sem confirmação.
- Referências: Onfleet, Route Planner e documentação Google Maps Geocoding. Melhor UX com ações simples, sem novos listeners/consultas Firestore.
- R79-R2: regressão R78-R2 segue ativa: o layout reduzido de 210px é testado com recorte overflow-hidden e min-w-0, em vez de exigir a altura legada de 214px.
