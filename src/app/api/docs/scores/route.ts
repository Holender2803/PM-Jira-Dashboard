import { NextResponse } from 'next/server';
import { getCachedDocScores } from '@/lib/issue-store';
import { getDemoIssues } from '@/lib/demo-data';
import { scoreTicket } from '@/lib/docReadiness';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export async function GET() {
    try {
        if (DEMO_MODE) {
            const scores = getDemoIssues()
                .map((issue) => {
                    const readiness = scoreTicket(issue);
                    return {
                        key: issue.key,
                        score: readiness.score,
                        grade: readiness.grade,
                        missingFields: readiness.missingFields,
                        aiRatable: readiness.aiRatable,
                        aiRating: null,
                        aiRatedAt: null,
                    };
                })
                .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

            return NextResponse.json({
                scores,
                total: scores.length,
                readyCount: scores.filter((row) => row.grade === 'A' || row.grade === 'B').length,
            });
        }

        const scores = getCachedDocScores();
        return NextResponse.json({
            scores,
            total: scores.length,
            readyCount: scores.filter((row) => row.grade === 'A' || row.grade === 'B').length,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
