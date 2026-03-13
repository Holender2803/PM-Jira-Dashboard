import { NextResponse } from 'next/server';
import { createStakeholder, listStakeholders } from '@/lib/pm-os/repositories/stakeholders-repo';
import { parseStakeholderInput } from '@/lib/pm-os/validators';
import type { StakeholderInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        return NextResponse.json(listStakeholders({
            relationshipType: searchParams.get('relationshipType'),
            search: searchParams.get('search'),
            organization: searchParams.get('organization'),
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createStakeholder(parseStakeholderInput(body) as StakeholderInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
