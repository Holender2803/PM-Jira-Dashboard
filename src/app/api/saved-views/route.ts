import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { SavedView } from '@/types';

export async function GET() {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM saved_views ORDER BY is_default DESC, created_at ASC').all() as {
            id: string; name: string; description: string; filters: string;
            created_at: string; updated_at: string; is_default: number;
        }[];
        const views: SavedView[] = rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            filters: JSON.parse(r.filters),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            isDefault: r.is_default === 1,
        }));
        return NextResponse.json(views);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, filters } = body;
        const db = getDb();
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 11);
        db.prepare(`
      INSERT INTO saved_views (id, name, description, filters)
      VALUES (?, ?, ?, ?)
    `).run(id, name, description || null, JSON.stringify(filters || {}));
        return NextResponse.json({ ok: true, id });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const db = getDb();
        db.prepare('DELETE FROM saved_views WHERE id = ?').run(id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
