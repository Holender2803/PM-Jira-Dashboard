'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import PmTaskFormSheet from '@/components/tasks/PmTaskFormSheet';
import PmTaskList from '@/components/tasks/PmTaskList';
import { InitiativeRecord, PmTaskInput, PmTaskRecord } from '@/types/pm-os';

function bucketTasks(tasks: PmTaskRecord[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.reduce((acc, task) => {
        if (task.status === 'done') {
            acc.done.push(task);
            return acc;
        }

        if (!task.dueDate) {
            acc.upcoming.push(task);
            return acc;
        }

        const target = new Date(task.dueDate);
        target.setHours(0, 0, 0, 0);
        if (target.getTime() < today.getTime()) acc.overdue.push(task);
        else if (target.getTime() === today.getTime()) acc.today.push(task);
        else acc.upcoming.push(task);
        return acc;
    }, {
        overdue: [] as PmTaskRecord[],
        today: [] as PmTaskRecord[],
        upcoming: [] as PmTaskRecord[],
        done: [] as PmTaskRecord[],
    });
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<PmTaskRecord[]>([]);
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [activeTask, setActiveTask] = useState<PmTaskRecord | null>(null);
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [initiativeId, setInitiativeId] = useState('');
    const [owner, setOwner] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const initiativeResponse = await fetch('/api/initiatives', { cache: 'no-store' });
            const initiativeData = await initiativeResponse.json() as InitiativeRecord[];
            setInitiatives(initiativeData);

            const params = new URLSearchParams();
            if (status !== 'all') params.set('status', status);
            if (category !== 'all') params.set('category', category);
            if (initiativeId) params.set('initiativeId', initiativeId);
            if (owner.trim()) params.set('owner', owner.trim());

            const taskResponse = await fetch(`/api/pm/tasks?${params.toString()}`, { cache: 'no-store' });
            if (!taskResponse.ok) {
                throw new Error(`Failed to load tasks (${taskResponse.status})`);
            }
            const taskData = await taskResponse.json() as PmTaskRecord[];
            setTasks(taskData);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, [category, initiativeId, owner, status]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const buckets = useMemo(() => bucketTasks(tasks), [tasks]);

    const handleSave = async (input: PmTaskInput, id?: string) => {
        const response = await fetch(id ? `/api/pm/tasks/${id}` : '/api/pm/tasks', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save PM task.');
        }
        await loadData();
    };

    const handleToggleDone = async (task: PmTaskRecord) => {
        const nextStatus = task.status === 'done' ? 'todo' : 'done';
        await handleSave({
            title: task.title,
            category: task.category,
            status: nextStatus,
            ownerName: task.ownerName,
            dueDate: task.dueDate,
            initiativeId: task.initiativeId,
            meetingParticipants: task.meetingParticipants,
            notes: task.notes,
            linkedIssueKeys: task.linkedIssueKeys,
        }, task.id);
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">✅ PM Tasks</h1>
                        <p className="page-subtitle">Operational PM work that should not live in Jira.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setActiveTask(null); setSheetOpen(true); }}>
                        New PM Task
                    </button>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="all">All statuses</option>
                        <option value="todo">Todo</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                        <option value="all">All categories</option>
                        <option value="Discovery">Discovery</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Stakeholder">Stakeholder</option>
                        <option value="Strategy">Strategy</option>
                        <option value="Operations">Operations</option>
                    </select>
                    <select className="input" value={initiativeId} onChange={(event) => setInitiativeId(event.target.value)}>
                        <option value="">All initiatives</option>
                        {initiatives.map((initiative) => (
                            <option key={initiative.id} value={initiative.id}>{initiative.title}</option>
                        ))}
                    </select>
                    <input className="input" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Filter by owner" />
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <PmTaskList title="Overdue" tasks={buckets.overdue} onEdit={(task) => { setActiveTask(task); setSheetOpen(true); }} onToggleDone={handleToggleDone} />
                        <PmTaskList title="Today" tasks={buckets.today} onEdit={(task) => { setActiveTask(task); setSheetOpen(true); }} onToggleDone={handleToggleDone} />
                        <PmTaskList title="Upcoming" tasks={buckets.upcoming} onEdit={(task) => { setActiveTask(task); setSheetOpen(true); }} onToggleDone={handleToggleDone} />
                        <PmTaskList title="Done" tasks={buckets.done} onEdit={(task) => { setActiveTask(task); setSheetOpen(true); }} onToggleDone={handleToggleDone} />
                    </div>
                )}
            </div>

            <PmTaskFormSheet
                open={sheetOpen}
                task={activeTask}
                initiatives={initiatives}
                onClose={() => setSheetOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}
