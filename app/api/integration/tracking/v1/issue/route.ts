import { NextRequest } from 'next/server';
import { issue } from '@/lib/tracking/gate1/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return issue(request); }
