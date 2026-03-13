import { NextResponse } from 'next/server';
import { getCommandCenterSummary } from '@/lib/pm-os/services/command-center-service';

export async function GET() {
    try {
        return NextResponse.json(getCommandCenterSummary());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
