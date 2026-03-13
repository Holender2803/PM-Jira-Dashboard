import { NextResponse } from 'next/server';
import { getObjectiveById, updateObjective } from '@/lib/pm-os/repositories/objectives-repo';
import { parseObjectiveInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const objective = getObjectiveById(id);
        if (!objective) {
            return NextResponse.json({ error: 'Objective not found.' }, { status: 404 });
        }
        return NextResponse.json(objective);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateObjective(id, parseObjectiveInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Objective not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
