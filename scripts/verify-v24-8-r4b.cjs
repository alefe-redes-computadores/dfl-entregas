const fs=require('fs');
const ok=(v,m)=>{if(!v)throw new Error(`V24.8 R4B: ${m}`);console.log('OK:',m)};
const read=(f)=>fs.readFileSync(f,'utf8');

const report=read('lib/reports/buildReportModel.ts');
const normalizedStart=report.indexOf('const normalized: ReportDelivery[]');
const periodStart=report.indexOf('const period = buildPeriod', normalizedStart);
ok(normalizedStart >= 0 && periodStart > normalizedStart, 'bloco normalized do relatório localizado');
const normalizedBlock=report.slice(normalizedStart, periodStart);
ok(normalizedBlock.includes('!delivery.exclude_customer_metrics'), 'flag de exclusão aplicada antes das agregações');
ok(normalizedBlock.includes('!isInternalOperationalCustomer(delivery.customer)'), 'cliente interno excluído antes das agregações');
ok(normalizedBlock.includes('!isInternalOperationalRoute(delivery.route)'), 'rota interna excluída antes das agregações');
ok(!report.includes('Comercial permanece íntegro; apenas os recortes operacionais'), 'regra antiga de exclusão parcial removida');

const highlights=read('lib/delivery-intelligence/selectHighlights.ts');
ok(highlights.includes("if (insight.category === 'demand') return 'demand'"), 'demanda deduplicada por família');
ok(highlights.includes('const categories = new Map<string, number>()'), 'hierarquia limita repetição de categoria');
ok(highlights.includes('Se a diversidade deixou vagas'), 'segunda passada preserva limite útil');

const radar=read('components/home/OperationalRadar.tsx');
ok(radar.includes("item.severity === 'warning'"), 'warning é prioridade máxima na Home');
ok(radar.includes("item.category !== 'data-quality'"), 'atenção operacional precede ruído de qualidade');
ok(radar.includes('confidenceLabel(signal.confidence)'), 'Home comunica confiança do sinal');

const stock=read('lib/stock-intelligence.ts');
ok(stock.includes("'revisar_unidade'"), 'inteligência possui estado explícito de revisão de unidade');
ok(stock.includes('function hasSemanticUnitRisk'), 'guard semântico centralizado');
ok(stock.includes('presentation.purchase_unit !== product.unit'), 'guard exige conflito embalagem/apresentação');
ok(stock.includes('Number(presentation.conversion_quantity) > 1'), 'guard exige conversão material; embalagem-base sozinha não é condenada');
ok(stock.includes('Consumo aguardando revisão da unidade'), 'cérebro explica por que não extrapola');
ok(!stock.includes('semanticUnitRisk ? 156'), 'nenhum fator físico é inventado');

const cats=read('lib/stock-categories.ts');
ok(cats.includes("if(/embalagem/.test(value))return'cyan'"), 'Embalagens recebe tom premium no helper legado');
ok(cats.includes("if(/limpeza/.test(value))return'sky'"), 'Limpeza e higiene recebe tom premium no helper legado');
ok(cats.includes("if (value === 'Embalagens') return 'teal'"), 'identidade visual canônica de Embalagens preservada');
ok(cats.includes("if (value === 'Limpeza e higiene') return 'sky'"), 'identidade visual canônica de Limpeza preservada');

console.log('\n============================================================');
console.log(' V24.8 R4B — CONTRATOS OK');
console.log('============================================================');
