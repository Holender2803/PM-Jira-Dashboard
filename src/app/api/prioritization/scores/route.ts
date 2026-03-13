import { NextResponse } from 'next/server';
import {
    createPrioritizationScore,
    listPrioritizationScoreViews,
} from '@/lib/pm-os/repositories/prioritization-repo';
import { parsePrioritizationInput } from '@/lib/pm-os/validators';
import type { PrioritizationInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scores = listPrioritizationScoreViews({
            targetType: searchParams.get('targetType'),
            initiativeId: searchParams.get('initiativeId'),
        });
        return NextResponse.json(scores);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createPrioritizationScore(parsePrioritizationInput(body) as PrioritizationInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        const message = String(error);
        const status = message.includes('UNIQUE') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
