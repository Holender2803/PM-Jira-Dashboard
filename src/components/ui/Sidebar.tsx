'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import {
    LayoutDashboard, Zap, PieChart, GitBranch, Bug,
    Clock, Ticket, Sparkles, Settings, Bookmark,
    RefreshCw, ChevronLeft, ChevronRight, Database, CircleHelp, Layers
} from 'lucide-react';
import { useState } from 'react';
import { formatTimeForDisplay } from '@/lib/time';

const NAV_ITEMS = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/sprint', label: 'Sprint', icon: Zap },
    { href: '/focus', label: 'Focus', icon: Ticket },
    { href: '/work-mix', label: 'Work Mix', icon: PieChart },
    { href: '/workflow', label: 'Workflow', icon: GitBranch },
    { href: '/bugs', label: 'Bugs', icon: Bug },
    { href: '/aging', label: 'Aging', icon: Clock },
    { href: '/epics', label: 'Epics', icon: Layers },
    { href: '/tickets', label: 'Tickets', icon: Database },
    { href: '/ai-reports', label: 'AI Reports', icon: Sparkles },
    { href: '/info', label: 'Info', icon: CircleHelp },
];

interface SidebarProps {
    onRefresh?: () => void;
    syncing?: boolean;
}

export default function Sidebar({ onRefresh, syncing }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { lastSynced, totalIssues, demoMode, sidebarOpen, setSidebarOpen, savedViews, applyView } = useAppStore();
    const [showViews, setShowViews] = useState(false);

    return (
        <div className="sidebar" style={{ width: sidebarOpen ? 240 : 64, transition: 'width 0.25s ease', minWidth: 0 }}>
            {/* Header */}
            <div style={{
                padding: sidebarOpen ? '20px 16px 16px' : '20px 8px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                {sidebarOpen && (
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>⚡</span>
                            <span>MDFM Analytics</span>
                        </div>
                        {demoMode && (
                            <div style={{ fontSize: 10, color: 'var(--accent-light)', marginTop: 2, fontWeight: 500 }}>
                                DEMO MODE
                            </div>
                        )}
                    </div>
                )}
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title={sidebarOpen ? 'Collapse' : 'Expand'}
                    style={{ padding: 6, borderRadius: 6 }}
                >
                    {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <div style={{ padding: '12px 0', flex: 1 }}>
                <div style={{ padding: sidebarOpen ? '0 8px 4px' : '0 8px 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                    {sidebarOpen ? 'Dashboards' : ''}
                </div>
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                    return (
                        <a
                            key={href}
                            href={href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            title={!sidebarOpen ? label : undefined}
                            style={{ justifyContent: sidebarOpen ? 'flex-start' : 'center', padding: sidebarOpen ? '9px 16px' : '9px' }}
                            onClick={(e) => { e.preventDefault(); router.push(href); }}
                        >
                            <Icon size={16} className="nav-icon" />
                            {sidebarOpen && <span className="nav-label">{label}</span>}
                        </a>
                    );
                })}

                {/* Saved Views */}
                {sidebarOpen && (
                    <div style={{ marginTop: 16 }}>
                        <div
                            style={{
                                padding: '0 8px 4px', fontSize: 10, color: 'var(--text-muted)',
                                fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                                marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                            }}
                            onClick={() => setShowViews(!showViews)}
                        >
                            <Bookmark size={10} /> Saved Views {showViews ? '▾' : '▸'}
                        </div>
                        {showViews && savedViews.slice(0, 8).map(view => (
                            <div
                                key={view.id}
                                className="nav-item"
                                onClick={() => { applyView(view); router.push('/tickets'); }}
                                style={{ paddingLeft: 24, fontSize: 12 }}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                                {view.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--border)', padding: sidebarOpen ? '12px 16px' : '12px 8px' }}>
                {sidebarOpen && (
                    <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                            {totalIssues > 0 && <div>{totalIssues} issues loaded</div>}
                            {lastSynced && <div>Synced {formatTimeForDisplay(lastSynced, { includeZone: true })}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={onRefresh}
                                disabled={syncing}
                                style={{ flex: 1 }}
                            >
                                <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                                {syncing ? 'Syncing…' : 'Refresh'}
                            </button>
                            <a href="/settings" className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                                <Settings size={14} />
                            </a>
                        </div>
                    </>
                )}
                {!sidebarOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={onRefresh} title="Refresh" style={{ padding: 6 }}>
                            <RefreshCw size={14} />
                        </button>
                        <a href="/settings" className="btn btn-ghost btn-sm" title="Settings" style={{ padding: 6 }}>
                            <Settings size={14} />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
