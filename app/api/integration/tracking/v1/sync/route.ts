import { NextRequest } from 'next/server';
import { sync } from '@/lib/tracking/gate1/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return sync(request); }
