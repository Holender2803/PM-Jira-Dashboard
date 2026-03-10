import { NextResponse } from 'next/server';
import {
    createStatusReport,
    listStatusReports,
    normalizeReportAudience,
} from '@/lib/status-reports';

interface GenerateStatusReportBody {
    audience?: unknown;
    isAuto?: unknown;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as GenerateStatusReportBody;
        const audience = normalizeReportAudience(body.audience);
        const report = await createStatusReport({
            audience,
            isAuto: Boolean(body.isAuto),
        });

        return NextResponse.json(report);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    try {
        return NextResponse.json(listStatusReports(10));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
