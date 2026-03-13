import { NextResponse } from 'next/server';
import { getKpiById, updateKpi } from '@/lib/pm-os/repositories/kpis-repo';
import { parseKpiInput } from '@/lib/pm-os/validators';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const kpi = getKpiById(id);
        if (!kpi) {
            return NextResponse.json({ error: 'KPI not found.' }, { status: 404 });
        }
        return NextResponse.json(kpi);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const updated = updateKpi(id, parseKpiInput(body, true));
        if (!updated) {
            return NextResponse.json({ error: 'KPI not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
