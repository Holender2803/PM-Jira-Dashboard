import { NextResponse } from 'next/server';
import { getOutcomeById, updateOutcome } from '@/lib/pm-os/repositories/outcomes-repo';
import { parseOutcomeInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const outcome = getOutcomeById(id);
        if (!outcome) {
            return NextResponse.json({ error: 'Outcome not found.' }, { status: 404 });
        }
        return NextResponse.json(outcome);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateOutcome(id, parseOutcomeInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Outcome not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
