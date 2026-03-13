import { NextResponse } from 'next/server';
import { getFintechContextItemById, updateFintechContextItem } from '@/lib/pm-os/repositories/fintech-context-repo';
import { parseFintechContextItemInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const item = getFintechContextItemById(id);
        if (!item) {
            return NextResponse.json({ error: 'Fintech context item not found.' }, { status: 404 });
        }
        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateFintechContextItem(id, parseFintechContextItemInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Fintech context item not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
