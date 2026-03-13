import { NextResponse } from 'next/server';
import { createKpi, listKpis } from '@/lib/pm-os/repositories/kpis-repo';
import { parseKpiInput } from '@/lib/pm-os/validators';
import type { KpiInput } from '@/types/pm-os';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        return NextResponse.json(listKpis({
            outcomeId: searchParams.get('outcomeId'),
        }));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createKpi(parseKpiInput(body) as KpiInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
