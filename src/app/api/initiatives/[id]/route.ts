import { NextResponse } from 'next/server';
import { getInitiativeById, updateInitiative } from '@/lib/pm-os/repositories/initiatives-repo';
import { attachInitiativeHealth } from '@/lib/pm-os/services/initiative-health-service';
import { parseInitiativeInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const initiative = getInitiativeById(id);
        if (!initiative) {
            return NextResponse.json({ error: 'Initiative not found.' }, { status: 404 });
        }

        return NextResponse.json(attachInitiativeHealth([initiative])[0]);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateInitiative(id, parseInitiativeInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Initiative not found.' }, { status: 404 });
        }

        return NextResponse.json(attachInitiativeHealth([updated])[0]);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
