import { NextResponse } from 'next/server';
import { deleteStakeholder, getStakeholderById, updateStakeholder } from '@/lib/pm-os/repositories/stakeholders-repo';
import { parseStakeholderInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const stakeholder = getStakeholderById(id);
        if (!stakeholder) {
            return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 });
        }
        return NextResponse.json(stakeholder);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateStakeholder(id, parseStakeholderInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const deleted = deleteStakeholder(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
