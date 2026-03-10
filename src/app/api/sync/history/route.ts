import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface SyncHistoryRow {
    completedAt: string;
    issuesSynced: number;
}

export async function GET() {
    try {
        const db = getDb();
        const rows = db.prepare(`
      SELECT completed_at as completedAt, issues_synced as issuesSynced
      FROM sync_log
      WHERE status = 'done' AND completed_at IS NOT NULL
      ORDER BY completed_at ASC
      LIMIT 365
    `).all() as SyncHistoryRow[];

        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
