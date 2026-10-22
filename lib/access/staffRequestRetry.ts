/** R63: idempotência local para respostas incertas (timeout/offline).
 * O servidor persiste idempotência por uid + requestId em transação.
 * Não usa storage nem coordena dispositivos; a regra do servidor segue obrigatória.
 */
export type StaffRequestKind = 'delivery_confirmation' | 'purchase_intent';
interface PendingRequest { id:string; at:number }
export class StaffRequestRetry {
  private readonly entries = new Map<string,PendingRequest>();
  constructor(private readonly ttlMs = 15 * 60_000, private readonly maxEntries = 128) {}
  reserve(uid:string,kind:StaffRequestKind,targetId:string,quantity:number|undefined,now:number,createId:()=>string):string {
    const key=JSON.stringify([uid,kind,targetId,quantity??null]);
    for(const [item,value] of this.entries) if(now-value.at>this.ttlMs || now<value.at) this.entries.delete(item);
    const existing=this.entries.get(key);
    if(existing) return existing.id;
    while(this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const id=createId();
    this.entries.set(key,{id,at:now});
    return id;
  }
  reset():void {this.entries.clear();}
}
