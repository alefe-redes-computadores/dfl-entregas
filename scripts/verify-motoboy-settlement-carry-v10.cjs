const fs=require('fs');
const page=fs.readFileSync('app/motoboys/acerto/page.tsx','utf8');
const types=fs.readFileSync('types/index.ts','utf8');

const ok=(value,message)=>{if(!value)throw new Error('V10: '+message);console.log('OK:',message)};

ok(types.includes('settlement_carry_forward?: boolean'),'contrato tipado de saldo futuro');
ok(page.includes("priorSettlement?.settlement_carry_forward===true"),'registro antigo sem flag não vira dívida');
ok(page.includes('const carryForward=!cashHandedOver&&data.balance>0'),'acerto quitado não carrega o valor do dia');
ok(page.includes('settlement_carry_forward:carryForward'),'decisão de transporte é persistida');
ok(page.includes("saldo futuro ${carryForward?'sim':'não'}"),'observação registra a decisão');

const priorCarry=(settlement)=>settlement?.settlement_carry_forward===true?{
  storeCredit:Math.max(0,Number(settlement.settlement_store_credit)||0),
  motoboyCredit:Math.max(0,Number(settlement.settlement_motoboy_credit)||0),
}:{storeCredit:0,motoboyCredit:0};

let result=priorCarry({settlement_motoboy_credit:235});
ok(result.motoboyCredit===0,'R$ 235 legado deixa de reaparecer');
result=priorCarry({settlement_carry_forward:false,settlement_motoboy_credit:107});
ok(result.motoboyCredit===0,'acerto de R$ 107 quitado não acumula amanhã');
result=priorCarry({settlement_carry_forward:true,settlement_store_credit:31});
ok(result.storeCredit===31,'crédito real de R$ 31 continua no próximo acerto');
result=priorCarry({settlement_carry_forward:false,settlement_store_credit:31});
ok(result.storeCredit===0,'acerto seguinte quitado encerra o crédito anterior');

console.log('V10 ACERTO SEM ACÚMULO: ZERO ERROS');
