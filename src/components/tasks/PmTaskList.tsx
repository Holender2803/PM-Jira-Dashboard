'use client';

import { EmptyState } from '@/components/ui/Badges';
import { PmTaskRecord } from '@/types/pm-os';
import PmTaskCard from './PmTaskCard';

interface PmTaskListProps {
    title: string;
    tasks: PmTaskRecord[];
    onEdit: (task: PmTaskRecord) => void;
    onToggleDone: (task: PmTaskRecord) => Promise<void>;
}

export default function PmTaskList({ title, tasks, onEdit, onToggleDone }: PmTaskListProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>{title}</h2>
            {tasks.length === 0 ? (
                <div className="card"><EmptyState message={`No tasks in ${title.toLowerCase()}.`} icon="🗂" /></div>
            ) : (
                tasks.map((task) => (
                    <PmTaskCard key={task.id} task={task} onEdit={onEdit} onToggleDone={onToggleDone} />
                ))
            )}
        </div>
    );
}
