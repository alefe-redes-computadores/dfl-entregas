const fs=require("fs");
const ok=(v,m)=>{if(!v)throw Error("R5.7: "+m);console.log("OK:",m)};
const sem=fs.readFileSync("lib/stock-semantic-confidence-v24-8.ts","utf8");
const intel=fs.readFileSync("lib/stock-intelligence.ts","utf8");
ok(sem.includes("historical_ambiguity"),"estado semântico ambíguo explícito");
for(const id of [
"stock-1789058835068","stock-1789059135270","stock-1789059270912",
"stock-1789064245029-bi56y","stock-1789166741727-79tek",
"stock-1789748161060-hen8v","stock-1789785312950-2olr5",
"stock-1789785345739-vl1fu","catalog-luva"])
 ok(sem.includes(id),"caso ambíguo protegido: "+id);
ok(!sem.includes("catalog-agua-com-gas-500"),"água com gás não é confundida com GLP");
ok(!sem.includes("stock-1790443008324-xgpwj"),"Papel Metalizado convergido não é confundido com Papel Acoplado 400");
ok(intel.includes("stock-semantic-confidence-v24-8"),"inteligência conhece o guard semântico");
ok(!sem.includes("update(")&&!sem.includes("setDoc(")&&!sem.includes("firebase"),"guard não escreve no Firebase");
