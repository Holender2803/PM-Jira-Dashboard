import { NextResponse } from 'next/server';
import { getPmTaskById, updatePmTask } from '@/lib/pm-os/repositories/pm-tasks-repo';
import { parsePmTaskInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const task = getPmTaskById(id);
        if (!task) {
            return NextResponse.json({ error: 'PM task not found.' }, { status: 404 });
        }
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updatePmTask(id, parsePmTaskInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'PM task not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
