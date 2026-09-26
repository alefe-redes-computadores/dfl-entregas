const fs=require('fs');

for(const file of [
  'lib/delivery-inbox.ts',
  'app/loja/caixa-de-entrada/page.tsx'
]){
  const source=fs.readFileSync(file,'utf8');

  if(/\b(getDocs|getDoc|onSnapshot|collection|query|setDoc|addDoc)\s*\(/.test(source)){
    console.error('Firestore indevido em:',file);
    process.exit(1);
  }
}

console.log('OK: Caixa é local; zero Firestore próprio');
