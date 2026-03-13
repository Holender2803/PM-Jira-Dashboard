'use client';

export default function ScoreBadge({ score }: { score: number }) {
    return (
        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
            RICE {score.toFixed(2)}
        </span>
    );
}
