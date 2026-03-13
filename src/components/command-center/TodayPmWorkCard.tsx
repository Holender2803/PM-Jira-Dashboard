'use client';

import { CommandCenterSummary } from '@/types/pm-os';

export default function TodayPmWorkCard({ tasks }: { tasks: CommandCenterSummary['tasks'] }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <h3 style={{ fontSize: 15 }}>Today&apos;s PM Work</h3>
                <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    What needs attention today across overdue, due-today, and upcoming PM work.
                </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>{tasks.overdueCount} overdue</span>
                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>{tasks.todayCount} due today</span>
                <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.28)' }}>{tasks.upcomingCount} upcoming</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...tasks.overdue, ...tasks.today].slice(0, 5).map((task) => (
                    <div key={task.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                            <span>{task.category}</span>
                            <span>{task.dueDate || 'No due date'}</span>
                            {task.initiativeTitle && <span>{task.initiativeTitle}</span>}
                        </div>
                    </div>
                ))}
                {tasks.overdue.length + tasks.today.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No urgent PM tasks right now.</div>
                )}
            </div>
        </div>
    );
}
