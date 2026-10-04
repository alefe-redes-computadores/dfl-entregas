import fs from 'node:fs';
const p='android/app/src/main/AndroidManifest.xml';
if(!fs.existsSync(p)) throw new Error('V25: AndroidManifest ausente após cap sync');
let x=fs.readFileSync(p,'utf8');
if(!x.includes('android:scheme="dflentregas"')){
  const re=/(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>)([\s\S]*?)(<\/activity>)/;
  const m=x.match(re); if(!m) throw new Error('V25: MainActivity não localizada');
  const deep=`\n            <!-- DFL V25: Admin → Entregas -->\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="dflentregas" android:host="delivery" />\n            </intent-filter>`;
  x=x.replace(re,`${m[1]}${m[2]}${deep}${m[3]}`); fs.writeFileSync(p,x);
}
for(const t of ['android:scheme="dflentregas"','android:host="delivery"','android.intent.category.BROWSABLE']) if(!fs.readFileSync(p,'utf8').includes(t)) throw new Error('V25: token ausente '+t);
console.log('V25 ANDROID PATCH OK');

// V29_SINGLE_TASK: deep link deve chegar na Activity existente.
{
  let current=fs.readFileSync(p,'utf8');
  const re=/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/;
  const m=current.match(re);
  if(!m) throw new Error('V29: MainActivity não localizada para singleTask');
  if(!m[0].includes('android:launchMode="singleTask"')){
    const next=m[0].replace(/>$/, ' android:launchMode="singleTask">');
    current=current.replace(m[0],next);
    fs.writeFileSync(p,current);
  }
}
if(!fs.readFileSync(p,'utf8').includes('android:launchMode="singleTask"')) throw new Error('V29: singleTask ausente');
