'use client';

import { PmTaskRecord } from '@/types/pm-os';
import DueDateBadge from './DueDateBadge';

interface PmTaskCardProps {
    task: PmTaskRecord;
    onEdit: (task: PmTaskRecord) => void;
    onToggleDone: (task: PmTaskRecord) => Promise<void>;
}

export default function PmTaskCard({ task, onEdit, onToggleDone }: PmTaskCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <h3 style={{ fontSize: 15 }}>{task.title}</h3>
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
                            {task.category}
                        </span>
                        <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>
                            {task.status.replace('_', ' ')}
                        </span>
                    </div>
                    {task.notes && (
                        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {task.notes}
                        </p>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(task)}>Edit</button>
                    <button className="btn btn-primary btn-sm" onClick={() => void onToggleDone(task)}>
                        {task.status === 'done' ? 'Reopen' : 'Mark Done'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <DueDateBadge dueDate={task.dueDate} />
                {task.ownerName && <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>{task.ownerName}</span>}
                {task.initiativeTitle && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{task.initiativeTitle}</span>}
                {task.meetingParticipants.length > 0 && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>{task.meetingParticipants.length} participants</span>}
                {task.linkedIssueKeys.length > 0 && <span className="badge" style={{ background: 'rgba(168,85,247,0.12)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.28)' }}>{task.linkedIssueKeys.length} Jira links</span>}
            </div>
        </div>
    );
}
