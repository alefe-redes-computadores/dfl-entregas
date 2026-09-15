import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationOutbox } from '@/lib/integration/server/reverseRelay';
export const runtime='nodejs'; export const dynamic='force-dynamic';
function equal(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
function authorized(req:NextRequest){const secret=process.env.DFL_REVERSE_WORKER_SECRET||process.env.CRON_SECRET||''; const auth=req.headers.get('authorization')||''; return Boolean(secret)&&auth.startsWith('Bearer ')&&equal(auth.slice(7),secret)}
async function run(req:NextRequest){if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401}); try{const reconciliation=await reconcileReverseTrackingOutbox(); const relay=await drainReverseIntegrationOutbox(); console.log('[integration/reverse-worker]',{candidates:reconciliation.candidates,created:reconciliation.created,existing:reconciliation.existing,claimed:relay.claimed,sent:relay.sent,failed:relay.failed}); return NextResponse.json({ok:relay.failed===0,reconciliation,relay},{status:relay.failed?207:200});}catch(e){const message=e instanceof Error?e.message:'Reverse worker failed'; console.error('[integration/reverse-worker]',message); return NextResponse.json({ok:false,error:message},{status:500});}}
export const GET=run; export const POST=run;
