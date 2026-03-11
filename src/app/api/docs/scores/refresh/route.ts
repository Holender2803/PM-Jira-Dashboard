import { NextResponse } from 'next/server';
import { refreshAllDocScores } from '@/lib/issue-store';
import { getDemoIssues } from '@/lib/demo-data';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export async function POST() {
    try {
        if (DEMO_MODE) {
            return NextResponse.json({
                ok: true,
                updated: getDemoIssues().length,
                refreshedAt: new Date().toISOString(),
            });
        }

        const result = refreshAllDocScores();
        return NextResponse.json({
            ok: true,
            updated: result.updated,
            refreshedAt: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
