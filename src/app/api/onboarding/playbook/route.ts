import { NextResponse } from 'next/server';
import { getOnboardingPlaybook } from '@/lib/pm-os/repositories/onboarding-repo';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playbook = getOnboardingPlaybook(searchParams.get('id') || undefined);
        if (!playbook) {
            return NextResponse.json({ error: 'Onboarding playbook not found.' }, { status: 404 });
        }
        return NextResponse.json(playbook);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
