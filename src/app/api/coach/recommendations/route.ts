import { NextResponse } from 'next/server';
import { getGuidanceRecommendations } from '@/lib/pm-os/services/coach-service';

export async function GET() {
    try {
        return NextResponse.json(getGuidanceRecommendations());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
