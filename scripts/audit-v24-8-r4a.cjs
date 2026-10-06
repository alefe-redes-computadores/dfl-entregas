const fs=require('fs'), path=require('path');
const roots=['app','components','hooks','lib','store'];
const exts=new Set(['.ts','.tsx','.js','.jsx']);
const files=[];
function walk(d){if(!fs.existsSync(d))return;for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(exts.has(path.extname(p)))files.push(p)}}
roots.forEach(walk);
const tests={
 insights:/insight|highlight|OperationalRadar|IntelligencePanel/i,
 reports:/report|relat[oó]rio|analytics|motoboy|ranking/i,
 exclusion:/isOperationalCustomer|excludedCustomer|exclude|ignorar|ignore/i,
 stockBrain:/consumo|consumption|average.*day|daily.*average|stock.*intelligence|dias.*zer/i,
 stockVisual:/StockCategoryIcon|stockCategoryTone|Embalagens|Limpeza e higiene/i
};
const out={generated_at:new Date().toISOString(),matches:{}};
for(const [k,re] of Object.entries(tests)){
 out.matches[k]=[];
 for(const f of files){
  const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);
  lines.forEach((line,i)=>{if(re.test(line))out.matches[k].push({file:f,line:i+1,text:line.trim().slice(0,240)})});
 }
}
const dest=process.env.DFL_R4A_REPORT || path.join(process.env.HOME,'storage/downloads',`v24-8-r4a-code-audit-${Date.now()}.json`);
fs.writeFileSync(dest,JSON.stringify(out,null,2));
console.log(dest);
for(const k of Object.keys(out.matches)) console.log(`${k}: ${out.matches[k].length} ocorrência(s)`);
