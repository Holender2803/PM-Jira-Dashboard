import { NextResponse } from 'next/server';
import {
    getPrioritizationScoreById,
    updatePrioritizationScore,
} from '@/lib/pm-os/repositories/prioritization-repo';
import { parsePrioritizationInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const score = getPrioritizationScoreById(id);
        if (!score) {
            return NextResponse.json({ error: 'Prioritization score not found.' }, { status: 404 });
        }
        return NextResponse.json(score);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updatePrioritizationScore(id, parsePrioritizationInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'Prioritization score not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
