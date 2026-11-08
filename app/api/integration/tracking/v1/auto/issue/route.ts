import {NextRequest} from 'next/server';
import {issueInitial} from '@/lib/tracking/gate6/auto-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){return issueInitial(req);}
