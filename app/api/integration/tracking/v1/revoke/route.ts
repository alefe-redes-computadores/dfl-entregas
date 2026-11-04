import { NextRequest } from 'next/server';
import { revoke } from '@/lib/tracking/gate1/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return revoke(request); }
