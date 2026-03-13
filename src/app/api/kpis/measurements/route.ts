import { NextResponse } from 'next/server';
import { addKpiMeasurement } from '@/lib/pm-os/repositories/kpis-repo';
import { parseKpiMeasurementInput } from '@/lib/pm-os/validators';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const measurement = addKpiMeasurement(parseKpiMeasurementInput(body));
        return NextResponse.json(measurement, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
