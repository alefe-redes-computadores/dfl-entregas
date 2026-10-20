'use strict';
/** Run ONLY against a Firestore emulator on port 8086, with an isolated demo- project. */
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,query,limit}=require('firebase/firestore');

const PROJECT='demo-dfl-entregas-r24';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
const MOTO='motoboy-unit-r24';
const BUYER='compras-unit-r24';
const STRANGER='intruso-unit-r24';
const SUSPENDED='suspenso-unit-r24';

async function main(){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8086','Sem Firebase Emulator correto. Abortando.');
 assert.equal(process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT||PROJECT,PROJECT,'Projeto inesperado.');
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8086}});
 let n=0;
 async function pass(task,label){ await assertSucceeds(task);console.log('ALLOW:',label);n++;}
 async function deny(task,label){await assertFails(task);console.log('DENY:',label);n++;}
 try {
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const [uid,role,status,perms,linked] of [
    [MOTO,'motoboy','active',['home','routes_read','deliveries_read','stock_read','finance'],'moto-one'],
    [BUYER,'compras','active',['home','stock_read','purchases_read','routes_read'],null],
    [SUSPENDED,'motoboy','suspended',['home','routes_read'],'moto-one'],
   ]) {
    await setDoc(doc(db,'staff_accounts',uid),{
     uid,role,status,permissions:perms,
     ...(linked?{linkedMotoboyId:linked}:{}),
    });
    for(const section of ['home','routes','deliveries','stock','purchases']){
     await setDoc(doc(db,'staff_workspaces',uid,section,'row-one'),{title:'Resumo minimo',status:'ativo',subtitle:'sem dados financeiros'});
    }
   }
   await setDoc(doc(db,'staff_accounts',STRANGER),{uid:STRANGER,status:'active',role:'motoboy',permissions:['home']});
   await setDoc(doc(db,'routes','admin-route'),{motoboy_id:'moto-one',secret:'admin'});
   await setDoc(doc(db,'deliveries','admin-delivery'),{route_id:'admin-route',phone:'123'});
   await setDoc(doc(db,'stock_products','admin-product'),{current_quantity:10,average_cost:123});
   await setDoc(doc(db,'finance','admin-money'),{amount:123});
  });
  const owner=env.authenticatedContext(OWNER).firestore();
  const moto=env.authenticatedContext(MOTO).firestore();
  const buyer=env.authenticatedContext(BUYER).firestore();
  const banned=env.authenticatedContext(SUSPENDED).firestore();
  const stranger=env.authenticatedContext(STRANGER).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const ref=(db,uid,section)=>doc(db,'staff_workspaces',uid,section,'row-one');
  await pass(getDoc(doc(owner,'routes','admin-route')),'proprietario le rotas raiz');
  await pass(setDoc(doc(owner,'staff_accounts','owner-created'),{status:'suspended'}),'proprietario escreve contas');
  await deny(getDoc(doc(anon,'routes','admin-route')),'anonimo nao le rotas');
  await deny(getDoc(doc(stranger,'deliveries','admin-delivery')),'nao autorizado nao le entregas raiz');
  await deny(getDoc(doc(moto,'stock_products','admin-product')),'motoboy nao le produtos admin');
  await deny(getDoc(doc(buyer,'finance','admin-money')),'compras nao le financeiro');
  await deny(getDoc(doc(moto,'staff_accounts',BUYER)),'conta nao le identidade alheia');
  await pass(getDoc(doc(moto,'staff_accounts',MOTO)),'conta consulta seu proprio status');
  await deny(getDocs(collection(moto,'staff_accounts')),'funcionario nao lista contas');
  await pass(getDoc(ref(moto,MOTO,'routes')),'motoboy le sua rota projetada');
  await pass(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(40))),'listagem limitada permitida');
  await deny(getDocs(collection(moto,'staff_workspaces',MOTO,'routes')),'listagem sem limite proibida');
  await deny(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(41))),'listagem acima de 40 proibida');
  await deny(getDoc(ref(moto,MOTO,'stock')),'motoboy nao le estoque apesar de permissao maliciosa');
  await deny(getDoc(ref(moto,BUYER,'stock')),'acesso cruzado entre funcionarios negado');
  await pass(getDoc(ref(buyer,BUYER,'stock')),'compras le seu estoque projetado');
  await pass(getDoc(ref(buyer,BUYER,'purchases')),'compras le suas compras projetadas');
  await deny(getDoc(ref(buyer,BUYER,'routes')),'compras nao le rotas mesmo com permissao extra');
  await deny(setDoc(ref(moto,MOTO,'routes'),{secret:true}),'funcionario nao escreve projeções');
  await deny(updateDoc(doc(moto,'staff_accounts',MOTO),{status:'active'}),'funcionario nao eleva privilegios');
  await deny(getDoc(ref(banned,SUSPENDED,'routes')),'conta suspensa nao le projecoes');
  await deny(getDoc(ref(anon,MOTO,'routes')),'anonimo nao le projecao alheia');
  // Revogacao: mesma sessao e mesmo token - alteracao de status deve bloquear na Rules.
  await env.withSecurityRulesDisabled(async ctx=>{
   await updateDoc(doc(ctx.firestore(),'staff_accounts',MOTO),{status:'suspended',permissions:[]});
  });
  await deny(getDoc(ref(moto,MOTO,'routes')),'revogacao nega leitura com token antigo');
  await pass(getDoc(doc(moto,'staff_accounts',MOTO)),'conta revogada pode consultar proprio status');
  console.log(`R24 FIRESTORE EMULATOR: ${n} testes aprovados. Nenhuma conexao com Firebase real.`);
 } finally {
  await env.cleanup();
 }
}
main().catch(e=>{console.error('R24 EMULATOR FALHOU',e);process.exitCode=1;});
