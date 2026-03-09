'use client';
import { IssueStatus, IssueType, Priority } from '@/types';
import { STATUS_COLORS, ISSUE_TYPE_COLORS } from '@/lib/workflow';

interface StatusBadgeProps {
    status: IssueStatus;
    size?: 'sm' | 'md';
}
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
    const color = STATUS_COLORS[status] || '#64748b';
    const padding = size === 'sm' ? '1px 6px' : '2px 8px';
    const fontSize = size === 'sm' ? '10px' : '11px';
    return (
        <span
            className="status-pill"
            style={{
                backgroundColor: `${color}22`,
                color,
                border: `1px solid ${color}44`,
                padding,
                fontSize,
            }}
        >
            {status}
        </span>
    );
}

const PRIORITY_COLORS: Record<string, string> = {
    Highest: '#ef4444',
    High: '#f97316',
    Medium: '#f59e0b',
    Low: '#22c55e',
    Lowest: '#64748b',
};

interface PriorityBadgeProps {
    priority: Priority | null;
}
export function PriorityBadge({ priority }: PriorityBadgeProps) {
    if (!priority) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color = PRIORITY_COLORS[priority] || '#64748b';
    return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="priority-dot" style={{ backgroundColor: color }} />
            <span style={{ color, fontSize: 12, fontWeight: 500 }}>{priority}</span>
        </span>
    );
}

interface IssueTypeBadgeProps {
    type: IssueType | string;
}

const TYPE_ICONS: Record<string, string> = {
    'Bug': '🐛',
    'Story': '📖',
    'Task': '✅',
    'Feature': '✨',
    'Epic': '⚡',
    'Subtask': '↳',
    'Technical Task': '🔧',
    'Spike': '🔍',
    'Developer Request': '💻',
    'Support': '🎧',
    'Chore': '🧹',
};

export function IssueTypeBadge({ type }: IssueTypeBadgeProps) {
    const color = ISSUE_TYPE_COLORS[type] || '#64748b';
    const icon = TYPE_ICONS[type] || '📋';
    return (
        <span
            className="badge"
            style={{
                backgroundColor: `${color}18`,
                color,
                border: `1px solid ${color}30`,
            }}
        >
            <span style={{ fontSize: 10 }}>{icon}</span>
            {type}
        </span>
    );
}

interface AvatarProps {
    name: string;
    size?: number;
}
export function Avatar({ name, size = 28 }: AvatarProps) {
    const initials = name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const colors = [
        ['#6366f1', '#312e81'],
        ['#8b5cf6', '#4c1d95'],
        ['#ec4899', '#831843'],
        ['#f59e0b', '#78350f'],
        ['#10b981', '#064e3b'],
        ['#06b6d4', '#164e63'],
    ];
    const idx = name.charCodeAt(0) % colors.length;
    const [fg, bg] = colors[idx];

    return (
        <div
            style={{
                width: size, height: size,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${bg}, ${fg})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: size * 0.35,
                fontWeight: 600,
                color: 'white',
                flexShrink: 0,
                border: '1.5px solid rgba(255,255,255,0.1)',
            }}
        >
            {initials}
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: number | string;
    change?: number;
    color?: string;
    icon?: React.ReactNode;
    suffix?: string;
    onClick?: () => void;
}
export function StatCard({ label, value, change, color = '#6366f1', icon, suffix, onClick }: StatCardProps) {
    return (
        <div
            className="stat-card"
            style={{ '--stat-color': color, cursor: onClick ? 'pointer' : 'default' } as React.CSSProperties}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-label">{label}</div>
                {icon && <div style={{ color, opacity: 0.7 }}>{icon}</div>}
            </div>
            <div className="stat-value">
                {value}{suffix && <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 2 }}>{suffix}</span>}
            </div>
            {change !== undefined && (
                <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
                    <span>{change >= 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(change)}% vs last sprint</span>
                </div>
            )}
        </div>
    );
}

interface ProgressBarProps {
    value: number;
    max?: number;
    color?: string;
    height?: number;
    showLabel?: boolean;
}
export function ProgressBar({ value, max = 100, color = '#6366f1', height = 6, showLabel = false }: ProgressBarProps) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="progress-bar" style={{ flex: 1, height }}>
                <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            {showLabel && <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 32 }}>{pct}%</span>}
        </div>
    );
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
    return (
        <div style={{ width: size, height: size, display: 'inline-flex' }}>
            <svg viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', width: '100%', height: '100%' }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3" fill="none" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
        </div>
    );
}

export function EmptyState({ message, icon = '📭' }: { message: string; icon?: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 24px', gap: 12, color: 'var(--text-muted)',
        }}>
            <span style={{ fontSize: 36 }}>{icon}</span>
            <p style={{ fontSize: 14 }}>{message}</p>
        </div>
    );
}
