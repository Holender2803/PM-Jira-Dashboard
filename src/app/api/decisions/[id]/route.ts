import { NextResponse } from 'next/server';
import { getDecisionById, updateDecision } from '@/lib/pm-os/repositories/decisions-repo';
import { parseDecisionInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const decision = getDecisionById(id);
        if (!decision) {
            return NextResponse.json({ error: 'Decision not found.' }, { status: 404 });
        }
        return NextResponse.json(decision);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateDecision(id, parseDecisionInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Decision not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
