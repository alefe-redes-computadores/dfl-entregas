const fs=require("fs");
const ok=(v,m)=>{if(!v)throw Error("R5.8: "+m);console.log("OK:",m)};
const sem=fs.readFileSync("lib/stock-semantic-confidence-v24-8.ts","utf8");
const notice=fs.readFileSync("components/stock/StockSemanticReviewNotice.tsx","utf8");
const intel=fs.readFileSync("lib/stock-intelligence.ts","utf8");

ok(sem.includes("stockConsumptionDisplayState"),"estado visual semântico centralizado");
ok(sem.includes("Consumo aguardando revisão da unidade"),"mensagem explícita de revisão");
ok(notice.includes("shouldSuppressStockConsumptionIntelligence"),"notice usa a mesma autoridade semântica");
ok(notice.includes("/estoque/editar?id="),"ação Revisar unidade leva ao editor");
ok(notice.includes("Saldo e movimentações continuam válidos"),"UI explica o que continua confiável");
ok(!notice.includes("firebase")&&!notice.includes("firestore"),"notice não acessa Firebase");
ok(intel.includes("stock-semantic-confidence-v24-8"),"inteligência mantém guard R5.7");
ok(!sem.includes("stock-1790443008324-xgpwj"),"Metalizado convergido continua fora da quarentena");
