import {NextRequest} from 'next/server';
import {providerReceipt} from '@/lib/tracking/gate6/auto-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){return providerReceipt(req);}
