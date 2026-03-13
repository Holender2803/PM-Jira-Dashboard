import { NextResponse } from 'next/server';
import { listPrioritizationCandidates } from '@/lib/pm-os/repositories/prioritization-repo';

export async function GET() {
    try {
        return NextResponse.json(listPrioritizationCandidates());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
