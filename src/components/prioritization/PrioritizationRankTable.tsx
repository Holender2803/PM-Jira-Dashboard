'use client';

import { PrioritizationScoreView } from '@/types/pm-os';
import ScoreBadge from './ScoreBadge';

interface PrioritizationRankTableProps {
    rows: PrioritizationScoreView[];
    onSelect: (row: PrioritizationScoreView) => void;
}

export default function PrioritizationRankTable({ rows, onSelect }: PrioritizationRankTableProps) {
    return (
        <div className="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Target</th>
                        <th>Type</th>
                        <th>Initiative</th>
                        <th>Score</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id}>
                            <td>{index + 1}</td>
                            <td>
                                <div style={{ fontWeight: 600 }}>{row.targetTitle}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {row.targetType === 'jira_issue' ? row.targetId : row.targetSummary || 'Manual initiative'}
                                </div>
                            </td>
                            <td>{row.targetType === 'initiative' ? 'Initiative' : row.targetIssueType || 'Jira Issue'}</td>
                            <td>{row.initiativeTitle || '—'}</td>
                            <td><ScoreBadge score={row.score} /></td>
                            <td>
                                <button className="btn btn-secondary btn-sm" onClick={() => onSelect(row)}>
                                    Edit
                                </button>
                            </td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                No RICE scores yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
