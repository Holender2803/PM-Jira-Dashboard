import { NextResponse } from 'next/server';
import { listNarratives } from '@/lib/pm-os/repositories/narratives-repo';
import { generateNarrative } from '@/lib/pm-os/services/narrative-service';
import { parseNarrativeRequest } from '@/lib/pm-os/validators';

export async function GET() {
    try {
        return NextResponse.json(listNarratives());
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const report = await generateNarrative(parseNarrativeRequest(body));
        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
