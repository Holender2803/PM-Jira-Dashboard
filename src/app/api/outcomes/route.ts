import { NextResponse } from 'next/server';
import { createOutcome, listOutcomes } from '@/lib/pm-os/repositories/outcomes-repo';
import { parseOutcomeInput } from '@/lib/pm-os/validators';
import type { OutcomeInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        return NextResponse.json(listOutcomes({
            objectiveId: searchParams.get('objectiveId'),
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createOutcome(parseOutcomeInput(body) as OutcomeInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
