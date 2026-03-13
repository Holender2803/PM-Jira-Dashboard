import { NextResponse } from 'next/server';
import { createPmTask, listPmTasks } from '@/lib/pm-os/repositories/pm-tasks-repo';
import { parsePmTaskInput } from '@/lib/pm-os/validators';
import type { PmTaskInput } from '@/types/pm-os';

function matchesDueBucket(dueDate: string | null, status: string, dueBucket: string | null): boolean {
    if (!dueBucket) return true;
    if (status === 'done') return dueBucket === 'done';
    if (!dueDate) return dueBucket === 'upcoming';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);

    if (dueBucket === 'overdue') return target.getTime() < today.getTime();
    if (dueBucket === 'today') return target.getTime() === today.getTime();
    if (dueBucket === 'upcoming') return target.getTime() > today.getTime();
    if (dueBucket === 'done') return status === 'done';
    return true;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dueBucket = searchParams.get('dueBucket');
        const tasks = listPmTasks({
            status: searchParams.get('status'),
            category: searchParams.get('category'),
            initiativeId: searchParams.get('initiativeId'),
            owner: searchParams.get('owner'),
        }).filter((task) => matchesDueBucket(task.dueDate, task.status, dueBucket));

        return NextResponse.json(tasks);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const created = createPmTask(parsePmTaskInput(body) as PmTaskInput);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
