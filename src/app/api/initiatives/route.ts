import { NextResponse } from 'next/server';
import { createInitiative, listInitiatives } from '@/lib/pm-os/repositories/initiatives-repo';
import { attachInitiativeHealth } from '@/lib/pm-os/services/initiative-health-service';
import { parseInitiativeInput } from '@/lib/pm-os/validators';
import type { InitiativeInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const initiatives = listInitiatives({
            status: searchParams.get('status'),
            search: searchParams.get('search'),
            owner: searchParams.get('owner'),
        });

        return NextResponse.json(attachInitiativeHealth(initiatives));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createInitiative(parseInitiativeInput(body) as InitiativeInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
