import { NextResponse } from 'next/server';
import { ownerNativeCors } from '@/lib/tracking/gate1/native-cors';
import { NextRequest } from 'next/server';
import { confirm } from '@/lib/tracking/gate1/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function OPTIONS(request: NextRequest) { const cors=ownerNativeCors(request.headers.get('origin'),'POST'); return new NextResponse(null,{status:cors?204:403,headers:cors||{'cache-control':'no-store'}}); }
export async function POST(request: NextRequest) { const cors=ownerNativeCors(request.headers.get('origin'),'POST'); if(!cors) return confirm(request); const result=await confirm(request); for(const [key,value] of Object.entries(cors))result.headers.set(key,value);return result; }
