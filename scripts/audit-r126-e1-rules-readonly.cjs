#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const crypto=require('node:crypto');const path=require('node:path');
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
const folder='security';const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(n=>/\.rules$/.test(n)).map(n=>path.join(folder,n)):[];
const candidate=files.map(file=>({file,sha256:hash(file)}));
const inventory=['lib/access/staffClaimPolicy.ts','lib/access/roles.ts','lib/access/staffRepository.ts','scripts/test-v111-r64-rules-emulator.cjs','scripts/pre-apk.cjs'].map(file=>({file,exists:fs.existsSync(file),sha256:fs.existsSync(file)?hash(file):null}));
const report={stage:'R126-E1',mode:'READ_ONLY',productionRulesVerified:false,staffActivationAuthorized:false,productionRulesComparison:'REQUIRES_MANUAL_EXPORT_FROM_FIREBASE_PROJECT',candidateRules:candidate,inventory,needs:['Confirmar projeto Firebase correto antes de exportar regras','Exportar ruleset efetivamente implantado de modo somente leitura por acesso administrativo autorizado','Comparar hash e conteudo das regras implantadas com candidato','Executar emulador com ruleset aprovado e suite de isolamento','Validar login e revogacao de identidade de teste antes de ativar funcionarios']};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
