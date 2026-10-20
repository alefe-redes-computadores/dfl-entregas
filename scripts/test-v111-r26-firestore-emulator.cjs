'use strict';
/** DFL R26: teste REAL da política em emulador local, sem credenciais de produção. */
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, limit } = require('firebase/firestore');
const HOST='127.0.0.1:8087';
const PROJECT='demo-dfl-entregas-r26';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
const MOTO='moto-00000001';
const MOTO_NO_LINK='moto-00000002';
const BUY='comp-00000001';
const CUSTOM='custom-00000001';
const REVOKED='revoked-00000001';
const UNKNOWN='unknown-00000001';
const OTHER='other-00000001';
async function main(){
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'Host inesperado; proibido conectar a outro Firebase.');
  assert.equal(process.env.GCLOUD_PROJECT,PROJECT,'Projeto deve ser exclusivamente demo.');
  assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '', '', 'Retire o projeto real do ambiente do teste.');
  const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8087}});
  let count=0;
  const allow=async (promise,label)=>{await assertSucceeds(promise);console.log(`ALLOW ${++count}: ${label}`);};
  const deny=async (promise,label)=>{await assertFails(promise);console.log(`DENY  ${++count}: ${label}`);};
  const account=(db,id)=>doc(db,'staff_accounts',id);
  const ws=(db,id,section,which='one')=>doc(db,'staff_workspaces',id,section,which);
  try{
    await env.withSecurityRulesDisabled(async ctx=>{
      const db=ctx.firestore();
      for(const [uid,role,status,permissions,linkedMotoboyId] of [
        [MOTO,'motoboy','active',['home','routes_read','deliveries_read','stock_read','purchases_read'],'moto1'],
        [MOTO_NO_LINK,'motoboy','active',['home','routes_read','deliveries_read'],null],
        [BUY,'compras','active',['home','stock_read','purchases_read','routes_read','deliveries_read'],null],
        [CUSTOM,'personalizado','active',['home','stock_read'],null],
        [REVOKED,'motoboy','suspended',['home','routes_read'],'moto1'],
        [OTHER,'operacao','active',['home'],null],
      ]){
        await setDoc(account(db,uid),{uid,role,status,permissions,...(linkedMotoboyId?{linkedMotoboyId}:{})});
        for(const section of ['home','routes','deliveries','stock','purchases']){
          await setDoc(ws(db,uid,section),{title:'Resumo operacional',subtitle:'Sem dados pessoais',status:'ok'});
        }
      }
      for(const col of ['routes','deliveries','customers','stock_products','stock_supplies','finance','staff_access_audit','staff_access_drafts']){
        await setDoc(doc(db,col,'rootdoc'),{adminOnly:true,customerPhone:'segredo'});
      }
    });
    const owner=env.authenticatedContext(OWNER).firestore();
    const moto=env.authenticatedContext(MOTO).firestore();
    const noLink=env.authenticatedContext(MOTO_NO_LINK).firestore();
    const buyer=env.authenticatedContext(BUY).firestore();
    const custom=env.authenticatedContext(CUSTOM).firestore();
    const suspended=env.authenticatedContext(REVOKED).firestore();
    const unknown=env.authenticatedContext(UNKNOWN).firestore();
    const other=env.authenticatedContext(OTHER).firestore();
    const anon=env.unauthenticatedContext().firestore();
    await allow(getDoc(doc(owner,'finance','rootdoc')),'owner le financas raiz');
    await allow(setDoc(doc(owner,'staff_accounts','test-owner'),{status:'suspended'}),'owner pode administrar');
    await deny(getDoc(doc(anon,'finance','rootdoc')),'anonimo negado');
    await deny(getDoc(account(anon,MOTO)),'anonimo nao ve cadastro staff');
    for(const [db,label] of [[moto,'motoboy'],[buyer,'compras'],[custom,'personalizado'],[unknown,'desconhecido']]){
      for(const col of ['routes','deliveries','customers','stock_products','stock_supplies','finance','staff_access_audit','staff_access_drafts']){
        await deny(getDoc(doc(db,col,'rootdoc')),`${label} nao le ${col} raiz`);
      }
    }
    await allow(getDoc(account(moto,MOTO)),'motoboy le proprio status');
    await allow(getDoc(account(suspended,REVOKED)),'suspenso le proprio status');
    await deny(getDoc(account(moto,BUY)),'motoboy nao le outra conta');
    await deny(getDocs(collection(moto,'staff_accounts')),'motoboy nao lista contas');
    await deny(setDoc(account(moto,MOTO),{uid:MOTO,status:'active'}),'motoboy nao cria/eleva status');
    await deny(updateDoc(account(moto,MOTO),{permissions:['finance']}),'motoboy nao eleva privilegios');
    await deny(deleteDoc(account(moto,MOTO)),'motoboy nao apaga cadastro');
    await allow(getDoc(ws(moto,MOTO,'routes')),'motoboy le suas rotas');
    await allow(getDoc(ws(moto,MOTO,'deliveries')),'motoboy le suas entregas');
    await allow(getDoc(ws(moto,MOTO,'home')),'motoboy le home');
    await deny(getDoc(ws(moto,MOTO,'stock')),'motoboy nao le estoque apesar da permissao injetada');
    await deny(getDoc(ws(moto,MOTO,'purchases')),'motoboy nao le compras apesar da permissao injetada');
    await deny(getDoc(ws(moto,BUY,'stock')),'motoboy nao le workspace alheio');
    await deny(getDoc(ws(noLink,MOTO_NO_LINK,'routes')),'motoboy sem vinculo nao le rotas');
    await deny(getDoc(ws(noLink,MOTO_NO_LINK,'deliveries')),'motoboy sem vinculo nao le entregas');
    await allow(getDoc(ws(buyer,BUY,'stock')),'compras le estoque');
    await allow(getDoc(ws(buyer,BUY,'purchases')),'compras le compras');
    await deny(getDoc(ws(buyer,BUY,'routes')),'compras nao le rotas apesar da permissao injetada');
    await deny(getDoc(ws(buyer,BUY,'deliveries')),'compras nao le entregas apesar da permissao injetada');
    await allow(getDoc(ws(custom,CUSTOM,'stock')),'personalizado le estoque autorizado');
    await deny(getDoc(ws(custom,CUSTOM,'purchases')),'personalizado sem permissao nao le compras');
    await deny(getDoc(ws(other,OTHER,'stock')),'operacao sem permissao nao le estoque');
    await deny(getDoc(ws(unknown,UNKNOWN,'home')),'UID desconhecido bloqueado');
    await deny(getDoc(ws(suspended,REVOKED,'routes')),'suspenso bloqueado');
    await deny(getDoc(ws(anon,MOTO,'routes')),'anonimo nao consulta staff workspace');
    await allow(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(40))),'listagem limitada 40');
    await allow(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(1))),'listagem limitada 1');
    await deny(getDocs(collection(moto,'staff_workspaces',MOTO,'routes')),'listagem sem limite negada');
    await deny(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(41))),'limite >40 negado');
    await deny(getDocs(query(collection(moto,'staff_workspaces',BUY,'routes'),limit(1))),'listagem workspace alheio negada');
    await deny(setDoc(ws(moto,MOTO,'routes'),{foo:'bar'}),'motoboy nao escreve projecoes');
    await deny(updateDoc(ws(buyer,BUY,'stock'),{status:'alterado'}),'compras nao edita projecao');
    await deny(deleteDoc(ws(custom,CUSTOM,'stock')),'personalizado nao remove projecao');
    await env.withSecurityRulesDisabled(async ctx=>{
      await updateDoc(account(ctx.firestore(),MOTO),{status:'suspended',permissions:[]});
    });
    await deny(getDoc(ws(moto,MOTO,'routes')),'revogacao imediata com o mesmo token');
    await deny(getDocs(query(collection(moto,'staff_workspaces',MOTO,'routes'),limit(2))),'revogacao bloqueia queries');
    await allow(getDoc(account(moto,MOTO)),'revogado consulta seu status de suspensao');
    await env.withSecurityRulesDisabled(async ctx=>{
      await updateDoc(account(ctx.firestore(),BUY),{uid:'outro-uid'});
    });
    await deny(getDoc(ws(buyer,BUY,'stock')),'identidade divergente bloqueada');
    console.log(`R26 EMULATOR: ${count} cenarios aprovados; nenhum contato com Firebase de producao.`);
  }finally{await env.cleanup();}
}
main().catch(e=>{console.error('R26 FIRESTORE EMULATOR FALHOU',e);process.exitCode=1;});
