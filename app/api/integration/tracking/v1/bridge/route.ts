/** R254: signed transport-only probe; disabled by default and never authorizes customers. */
import { NextRequest } from 'next/server';
import { probeBridge } from '@/lib/tracking/gate5/bridge-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){return probeBridge(request);}
