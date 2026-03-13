import { NextResponse } from 'next/server';
import { setOnboardingStepCompletion } from '@/lib/pm-os/repositories/onboarding-repo';
import { parseOnboardingProgressInput } from '@/lib/pm-os/validators';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const input = parseOnboardingProgressInput(body);
        const updated = setOnboardingStepCompletion(input.stepId, input.completed, input.note);
        if (!updated) {
            return NextResponse.json({ error: 'Onboarding step not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
