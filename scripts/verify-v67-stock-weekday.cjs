const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('lib/stock-daily-plan.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const Module=require('node:module');
const m=new Module('v67-test',module);
m.filename=process.cwd()+'/lib/stock-daily-plan.ts';
m.paths=module.paths;
m.require=(id)=>{
 if(id==='@/lib/stock-intelligence')return {buildStockRecommendation:()=>({averageDailyConsumption:1,leadTimeDays:2})};
 if(id==='@/lib/stock-shopping')return {commercialPurchasePlan:(_p,n)=>({baseQuantity:n})};
 if(id==='@/lib/stock-recommendation-guard')return {guardedStockRecommendation:()=>({mode:'history',quantity:0,reason:'teste'})};
 return require(id);
};
m._compile(js,m.filename);
const {buildDailyStockSignal}=m.exports;
const product={id:'p',current_quantity:0,minimum_quantity:0};
const now=new Date('2026-10-09T15:00:00-03:00'); // sexta-feira em São Paulo
const movement=(date,reason='consumo')=>({product_id:'p',type:'saida',quantity:3,occurred_at:date,reason});
const rows=[
 movement('2026-09-18T23:30:00-03:00'),
 movement('2026-09-25T23:30:00-03:00'),
 movement('2026-10-02T23:30:00-03:00'),
 movement('2026-10-09T12:00:00-03:00','Correção de contagem'),
 movement('2026-10-08T23:30:00-03:00')
];
const signal=buildDailyStockSignal(product,rows,now);
assert.equal(signal.weekdaySamples,3,'Três sextas válidas, incluindo 23h30 de São Paulo');
assert.equal(signal.weekdayAverage,3,'Correção acentuada e quinta-feira não são consumo da sexta');
assert.equal(signal.usesWeekday,true);
console.log('V67: fuso São Paulo, dias locais, acentos e consumo operacional OK');
