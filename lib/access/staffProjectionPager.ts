/** R127 E7 R3. Leitor paginado PURO para homologacao futura.
 * NAO integrado a transacoes Firestore: evita alterar R35/R36 antes de testes no emulador.
 */
export type ProjectionPage<Row> = {rows: Row[]; nextCursor?: string};
export class ProjectionPageError extends Error {
 constructor(message:string){super(message);this.name='ProjectionPageError';}
}
export async function collectProjectionPages<Row extends {id:string}>(
 readPage:(after:string|undefined,size:number)=>Promise<ProjectionPage<Row>>,
 options:{pageSize?:number;maxRows?:number}={},
):Promise<Row[]> {
 const size=options.pageSize??10;
 const max=options.maxRows??40;
 if(!Number.isSafeInteger(size)||size<1||size>10||!Number.isSafeInteger(max)||max<1||max>40)
  throw new ProjectionPageError('INVALID_BOUNDS');
 const seen=new Set<string>();
 const out:Row[]=[];
 let cursor:string|undefined;
 for(let pages=0;pages<=max;pages++){
  const page=await readPage(cursor,size);
  if(!page||!Array.isArray(page.rows)||page.rows.length>size)throw new ProjectionPageError('INVALID_PAGE');
  if(!page.rows.length){if(page.nextCursor)throw new ProjectionPageError('EMPTY_PAGE_CURSOR');return out;}
  for(const row of page.rows){
   if(!row||typeof row.id!=='string'||!row.id||row.id.includes('/')||seen.has(row.id))throw new ProjectionPageError('DUPLICATE_OR_INVALID_ID');
   if(cursor!==undefined&&row.id<=cursor)throw new ProjectionPageError('NON_MONOTONIC_PAGE');
   if(out.length>=max)throw new ProjectionPageError('TOO_MANY_OLD_PROJECTIONS');
   seen.add(row.id);out.push(row);cursor=row.id;
  }
  if(page.nextCursor===undefined){
   if(page.rows.length===size)throw new ProjectionPageError('AMBIGUOUS_TERMINATION');
   return out;
  }
  if(page.nextCursor!==cursor)throw new ProjectionPageError('INVALID_CURSOR');
 }
 throw new ProjectionPageError('PAGE_LIMIT');
}
