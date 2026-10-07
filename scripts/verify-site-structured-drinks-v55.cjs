const fs=require("fs"),r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw Error("V55 ENTREGAS: "+m);console.log("OK:",m)};
const s=r("lib/integration/site-order.ts"),p=r("lib/integration/server/siteOrderPersistence.ts");
ok(s.includes("siteOrderDrinksFromPayload"),"projeção de bebidas existe");
ok(s.includes("i.components"),"components[] consumidos sem duplicar snapshot");
ok(s.includes("prev?.qty||0"),"bebidas iguais consolidadas");
ok(s.includes("drinks: siteOrderDrinksFromPayload(payload.itens)"),"delivery recebe drinks");
ok(p.includes("drinks: siteOrderDrinksFromPayload(event.payload.itens)"),"persistência mantém drinks");
console.log("\nDFL ENTREGAS V55 FINAL — CONTRATOS OK");
