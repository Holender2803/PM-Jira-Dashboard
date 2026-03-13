import { NextResponse } from 'next/server';
import { createFintechContextItem, listFintechContextItems } from '@/lib/pm-os/repositories/fintech-context-repo';
import { parseFintechContextItemInput } from '@/lib/pm-os/validators';
import type { FintechContextItemInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        return NextResponse.json(listFintechContextItems({
            contextType: searchParams.get('contextType'),
            search: searchParams.get('search'),
            manualOnly: searchParams.get('manualOnly') === 'true',
            reconciliationOnly: searchParams.get('reconciliationOnly') === 'true',
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createFintechContextItem(parseFintechContextItemInput(body) as FintechContextItemInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
