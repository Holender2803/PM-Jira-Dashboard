import { NextResponse } from 'next/server';
import { getStakeholderInteractionById, updateStakeholderInteraction } from '@/lib/pm-os/repositories/stakeholders-repo';
import { parseStakeholderInteractionInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const interaction = getStakeholderInteractionById(id);
        if (!interaction) {
            return NextResponse.json({ error: 'Stakeholder interaction not found.' }, { status: 404 });
        }
        return NextResponse.json(interaction);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateStakeholderInteraction(id, parseStakeholderInteractionInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Stakeholder interaction not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
