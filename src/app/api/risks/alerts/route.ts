import { NextResponse } from 'next/server';
import { getStrategyRiskAlerts } from '@/lib/pm-os/services/risk-service';

export async function GET() {
    try {
        return NextResponse.json(getStrategyRiskAlerts());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
