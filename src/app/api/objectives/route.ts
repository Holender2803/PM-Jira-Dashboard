import { NextResponse } from 'next/server';
import { createObjective, listObjectives } from '@/lib/pm-os/repositories/objectives-repo';
import { getStrategyTree } from '@/lib/pm-os/services/strategy-service';
import { parseObjectiveInput } from '@/lib/pm-os/validators';
import type { ObjectiveInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const includeChildren = searchParams.get('includeChildren') === 'true';

        if (includeChildren) {
            return NextResponse.json(getStrategyTree());
        }

        return NextResponse.json(listObjectives({
            status: searchParams.get('status'),
            search: searchParams.get('search'),
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createObjective(parseObjectiveInput(body) as ObjectiveInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
