# V22.3 — Pedido operacional Site → Entregas

O recebimento técnico não confirma o pedido. `Pendente` fica em fila virtual de confirmação e não pode iniciar rota real. O Site envia snapshot imutável dos itens, preservando composição, acompanhamentos, adicionais e observação existentes no momento da compra. O Entregas não reconstrói combos pelo catálogo atual. `source_system=dfl_site` aparece como Site sem quebrar o enum legado `origin`.
