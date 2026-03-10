import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import {
    DEFAULT_BUG_TRACKING_CONFIG,
    type BugTrackingConfig,
} from '@/lib/bug-tracking';

interface BugTrackingConfigRow {
    bug_source_label: string;
    production_keywords: string;
    qa_keywords: string;
    configured: number;
    updated_at: string | null;
}

function normalizeInput(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function rowToConfig(row?: BugTrackingConfigRow): BugTrackingConfig {
    if (!row) {
        return { ...DEFAULT_BUG_TRACKING_CONFIG };
    }

    return {
        bugSourceLabel: row.bug_source_label,
        productionKeywords: row.production_keywords,
        qaKeywords: row.qa_keywords,
        configured: row.configured === 1,
        updatedAt: row.updated_at,
    };
}

export async function GET() {
    try {
        const db = getDb();
        const row = db.prepare(`
      SELECT bug_source_label, production_keywords, qa_keywords, configured, updated_at
      FROM bug_tracking_config
      WHERE id = 1
    `).get() as BugTrackingConfigRow | undefined;

        return NextResponse.json(rowToConfig(row));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const bugSourceLabel = normalizeInput(body?.bugSourceLabel, DEFAULT_BUG_TRACKING_CONFIG.bugSourceLabel);
        const productionKeywords = normalizeInput(body?.productionKeywords, DEFAULT_BUG_TRACKING_CONFIG.productionKeywords);
        const qaKeywords = normalizeInput(body?.qaKeywords, DEFAULT_BUG_TRACKING_CONFIG.qaKeywords);

        const db = getDb();
        db.prepare(`
      INSERT INTO bug_tracking_config (
        id,
        bug_source_label,
        production_keywords,
        qa_keywords,
        configured,
        updated_at
      )
      VALUES (1, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(id) DO UPDATE SET
        bug_source_label = excluded.bug_source_label,
        production_keywords = excluded.production_keywords,
        qa_keywords = excluded.qa_keywords,
        configured = 1,
        updated_at = excluded.updated_at
    `).run(bugSourceLabel, productionKeywords, qaKeywords);

        const row = db.prepare(`
      SELECT bug_source_label, production_keywords, qa_keywords, configured, updated_at
      FROM bug_tracking_config
      WHERE id = 1
    `).get() as BugTrackingConfigRow | undefined;

        return NextResponse.json({ ok: true, config: rowToConfig(row) });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
