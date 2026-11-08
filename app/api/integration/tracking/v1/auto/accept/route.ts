import {NextRequest} from 'next/server';
import {commercialAccept} from '@/lib/tracking/gate6/auto-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){return commercialAccept(req);}
