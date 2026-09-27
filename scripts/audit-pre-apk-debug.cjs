const fs=require('fs'), path=require('path');
const roots=['app','components','hooks','lib','store'];
let consoleCount=0,todoCount=0;
function walk(d){
 if(!fs.existsSync(d)) return;
 for(const n of fs.readdirSync(d)){
  const p=path.join(d,n),st=fs.statSync(p);
  if(st.isDirectory()) walk(p);
  else if(/\.(ts|tsx)$/.test(n)){
   const s=fs.readFileSync(p,'utf8');
   consoleCount+=(s.match(/console\.(log|warn|error)\s*\(/g)||[]).length;
   todoCount+=(s.match(/\b(TODO|FIXME|HACK)\b/g)||[]).length;
  }
 }
}
roots.forEach(walk);
console.log(`console.*: ${consoleCount}`);
console.log(`TODO/FIXME/HACK: ${todoCount}`);
