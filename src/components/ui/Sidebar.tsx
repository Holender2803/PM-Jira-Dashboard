'use client';
import { usePathname, useRouter } from 'next/navigation';
import { PAGE_GUIDES, START_DAY_FOCUS } from '@/lib/page-guides';
import { useAppStore } from '@/store/app-store';
import {
    LayoutDashboard, Zap, PieChart, GitBranch, Bug,
    Clock, Ticket, Sparkles, Settings, Bookmark,
    RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Database, CircleHelp, Layers, BarChart3, FileText,
    Target, ShieldAlert, ScrollText, GraduationCap, Compass, Users, Landmark
} from 'lucide-react';
import { CSSProperties, useState, type ComponentType } from 'react';
import { formatTimeForDisplay } from '@/lib/time';

interface NavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
}

interface NavSection {
    id: string;
    label: string;
    defaultOpen: boolean;
    collapsible?: boolean;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        id: 'start',
        label: 'Start Here',
        defaultOpen: true,
        collapsible: false,
        items: [
            { href: '/', label: 'Command Center', icon: LayoutDashboard },
            { href: '/tasks', label: 'PM Tasks', icon: Bookmark },
            { href: '/coach', label: 'Coach', icon: GraduationCap },
            { href: '/sprint', label: 'Sprint', icon: Zap },
            { href: '/focus', label: 'Focus', icon: Ticket },
            { href: '/onboarding', label: 'Onboarding', icon: Compass },
        ],
    },
    {
        id: 'run',
        label: 'Run PM Work',
        defaultOpen: false,
        items: [
            { href: '/initiatives', label: 'Initiatives', icon: Layers },
            { href: '/decisions', label: 'Decisions', icon: FileText },
            { href: '/stakeholders', label: 'Stakeholders', icon: Users },
        ],
    },
    {
        id: 'plan',
        label: 'Plan & Align',
        defaultOpen: false,
        items: [
            { href: '/strategy', label: 'Strategy', icon: Target },
            { href: '/prioritization', label: 'Prioritization', icon: Database },
            { href: '/risks', label: 'Risks', icon: ShieldAlert },
            { href: '/fintech-context', label: 'Fintech Context', icon: Landmark },
        ],
    },
    {
        id: 'communicate',
        label: 'Communicate',
        defaultOpen: false,
        items: [
            { href: '/narratives', label: 'Narratives', icon: ScrollText },
            { href: '/ai-reports', label: 'AI Reports', icon: Sparkles },
            { href: '/slideshow', label: 'Slideshow', icon: BarChart3 },
        ],
    },
    {
        id: 'investigate',
        label: 'Investigate & Admin',
        defaultOpen: false,
        items: [
            { href: '/work-mix', label: 'Work Mix', icon: PieChart },
            { href: '/workflow', label: 'Workflow', icon: GitBranch },
            { href: '/bugs', label: 'Bugs', icon: Bug },
            { href: '/aging', label: 'Aging', icon: Clock },
            { href: '/epics', label: 'Epics', icon: Layers },
            { href: '/tickets', label: 'Tickets', icon: Database },
            { href: '/docs', label: 'Ticket Docs', icon: FileText },
            { href: '/settings', label: 'Settings', icon: Settings },
            { href: '/info', label: 'Info', icon: CircleHelp },
        ],
    },
];

function labelForPath(path: string): string {
    return PAGE_GUIDES.find((guide) => guide.path === path)?.name || path;
}

interface SidebarProps {
    onRefresh?: () => void;
    syncing?: boolean;
}

export default function Sidebar({ onRefresh, syncing }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const {
        lastSynced,
        totalIssues,
        demoMode,
        sidebarOpen,
        setSidebarOpen,
        savedViews,
        applyView,
        isPmGuideEnabled,
        togglePmGuide,
        hasUnreadSyncBriefing,
} = useAppStore();
    const [showViews, setShowViews] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
        () => Object.fromEntries(NAV_SECTIONS.map((section) => [section.id, !section.defaultOpen]))
    );
    const pmGuideTitle = isPmGuideEnabled ? 'PM Guide ON' : 'PM Guide OFF';
    const pmGuideButtonStyle: CSSProperties = isPmGuideEnabled
        ? {
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.55)',
            color: '#fbbf24',
            boxShadow: '0 0 0 1px rgba(245,158,11,0.22), 0 0 14px rgba(245,158,11,0.25)',
        }
        : {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
        };

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
                {sidebarOpen && (
                    <div style={{ padding: '0 8px 12px' }}>
                        <div
                            className="card"
                            style={{
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.22))',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                                    Start Today
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                                    Use these first. Open the rest only when you need evidence or a specific workspace.
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {START_DAY_FOCUS.map((step, index) => (
                                    <button
                                        key={step.path}
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => router.push(step.path)}
                                        style={{
                                            justifyContent: 'space-between',
                                            border: '1px solid var(--border)',
                                            padding: '8px 10px',
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            <span
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    background: 'rgba(99,102,241,0.16)',
                                                    border: '1px solid rgba(99,102,241,0.3)',
                                                    color: 'var(--accent-light)',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                            <span style={{ textAlign: 'left' }}>{labelForPath(step.path)}</span>
                                        </span>
                                        <ChevronRight size={12} />
                                    </button>
                                ))}
                            </div>
                            <a href="/onboarding" className="btn btn-secondary btn-sm" onClick={(event) => { event.preventDefault(); router.push('/onboarding'); }}>
                                Full Workflow Guide
                            </a>
                        </div>
                    </div>
                )}

                {NAV_SECTIONS.map((section) => {
                    const isSectionActive = section.items.some(({ href }) => href === '/' ? pathname === '/' : pathname.startsWith(href));
                    const isCollapsed = collapsedSections[section.id] ?? false;
                    const shouldShowSection = !sidebarOpen || section.collapsible === false || isSectionActive || !isCollapsed;

                    return (
                        <div key={section.id} className="sidebar-section">
                            {sidebarOpen && (
                                <button
                                    type="button"
                                    className={`sidebar-section-toggle ${isSectionActive ? 'active' : ''}`}
                                    disabled={section.collapsible === false}
                                    onClick={() => setCollapsedSections((current) => ({
                                        ...current,
                                        [section.id]: !isCollapsed,
                                    }))}
                                    style={{ cursor: section.collapsible === false ? 'default' : 'pointer' }}
                                >
                                    <span>{section.label}</span>
                                    {section.collapsible === false ? null : (
                                        <ChevronDown
                                            size={12}
                                            style={{ transform: shouldShowSection ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
                                        />
                                    )}
                                </button>
                            )}

                            {shouldShowSection && section.items.map(({ href, label, icon: Icon }) => {
                                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                                const showUnreadSyncBriefing = href === '/ai-reports' && hasUnreadSyncBriefing;
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
                                        {showUnreadSyncBriefing && (
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    background: '#f59e0b',
                                                    boxShadow: '0 0 0 2px rgba(245,158,11,0.2)',
                                                    marginLeft: sidebarOpen ? 6 : -2,
                                                    flexShrink: 0,
                                                }}
                                                aria-label="New sync briefing available"
                                                title="New sync briefing available"
                                            />
                                        )}
                                        {sidebarOpen && <span className="nav-label">{label}</span>}
                                    </a>
                                );
                            })}
                        </div>
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
                            <button
                                type="button"
                                className="btn btn-sm"
                                onClick={togglePmGuide}
                                title={pmGuideTitle}
                                aria-label={pmGuideTitle}
                                aria-pressed={isPmGuideEnabled}
                                style={{ padding: '6px 8px', ...pmGuideButtonStyle }}
                            >
                                🎓
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
                        <button
                            type="button"
                            className="btn btn-sm"
                            onClick={togglePmGuide}
                            title={pmGuideTitle}
                            aria-label={pmGuideTitle}
                            aria-pressed={isPmGuideEnabled}
                            style={{ padding: 6, ...pmGuideButtonStyle }}
                        >
                            🎓
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
