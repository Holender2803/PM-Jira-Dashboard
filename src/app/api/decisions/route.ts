import { NextResponse } from 'next/server';
import { createDecision, listDecisions } from '@/lib/pm-os/repositories/decisions-repo';
import { parseDecisionInput } from '@/lib/pm-os/validators';
import type { DecisionInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const decisions = listDecisions({
            status: searchParams.get('status'),
            initiativeId: searchParams.get('initiativeId'),
            search: searchParams.get('search'),
        });
        return NextResponse.json(decisions);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createDecision(parseDecisionInput(body) as DecisionInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
