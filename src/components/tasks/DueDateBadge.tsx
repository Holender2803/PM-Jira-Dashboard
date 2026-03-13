'use client';

export default function DueDateBadge({ dueDate }: { dueDate: string | null }) {
    if (!dueDate) {
        return <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>No due date</span>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const meta = diff < 0
        ? { label: `Overdue by ${Math.abs(diff)}d`, color: '#fca5a5', border: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.12)' }
        : diff === 0
            ? { label: 'Due today', color: '#fbbf24', border: 'rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.12)' }
            : { label: `Due ${dueDate}`, color: '#93c5fd', border: 'rgba(59,130,246,0.28)', background: 'rgba(59,130,246,0.12)' };

    return (
        <span className="badge" style={{ color: meta.color, border: `1px solid ${meta.border}`, background: meta.background }}>
            {meta.label}
        </span>
    );
}
