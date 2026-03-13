import { NextResponse } from 'next/server';
import { getReportSchedule, saveReportSchedule } from '@/lib/report-schedule';

export async function GET() {
    try {
        return NextResponse.json(getReportSchedule());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const schedule = saveReportSchedule(body);
        return NextResponse.json({ ok: true, schedule });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
