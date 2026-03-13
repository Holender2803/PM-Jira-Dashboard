import { NextResponse } from 'next/server';
import { createStakeholderInteraction, listStakeholderInteractions } from '@/lib/pm-os/repositories/stakeholders-repo';
import { parseStakeholderInteractionInput } from '@/lib/pm-os/validators';
import type { StakeholderInteractionInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        return NextResponse.json(listStakeholderInteractions({
            stakeholderId: searchParams.get('stakeholderId'),
            initiativeId: searchParams.get('initiativeId'),
            search: searchParams.get('search'),
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createStakeholderInteraction(parseStakeholderInteractionInput(body) as StakeholderInteractionInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
