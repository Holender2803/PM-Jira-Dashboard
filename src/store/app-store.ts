'use client';
import { create } from 'zustand';
import { useMemo } from 'react';
import { JiraIssue, DashboardFilters, Sprint, AIReportResponse, SavedView } from '@/types';
import { filterIssues } from '@/lib/filters';
import { enrichIssuesWithEpicSummaries } from '@/lib/issue-format';

interface AppState {
    // Issues
    issues: JiraIssue[];
    isLoading: boolean;
    lastSynced: string | null;
    totalIssues: number;
    demoMode: boolean;

    // Filters
    filters: DashboardFilters;
    activeSprints: Sprint[];
    selectedKeys: Set<string>;

    // UI
    sidebarOpen: boolean;
    theme: 'dark' | 'light';

    // AI Reports
    aiReports: AIReportResponse[];

    // Saved Views
    savedViews: SavedView[];

    // Actions
    setIssues: (issues: JiraIssue[]) => void;
    setLoading: (v: boolean) => void;
    setFilters: (f: Partial<DashboardFilters>) => void;
    resetFilters: () => void;
    setSelectedKeys: (keys: Set<string>) => void;
    toggleSelected: (key: string) => void;
    clearSelection: () => void;
    setSidebarOpen: (v: boolean) => void;
    setTheme: (t: 'dark' | 'light') => void;
    addAIReport: (r: AIReportResponse) => void;
    setSavedViews: (v: SavedView[]) => void;
    applyView: (view: SavedView) => void;
    setActiveSprints: (s: Sprint[]) => void;
    setLastSynced: (t: string | null) => void;
    setTotalIssues: (n: number) => void;
    setDemoMode: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    issues: [],
    isLoading: false,
    lastSynced: null,
    totalIssues: 0,
    demoMode: false,
    filters: {},
    activeSprints: [],
    selectedKeys: new Set(),
    sidebarOpen: true,
    theme: 'dark',
    aiReports: [],
    savedViews: [],

    setIssues: (issues) => set({ issues: enrichIssuesWithEpicSummaries(issues) }),
    setLoading: (isLoading) => set({ isLoading }),
    setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),
    resetFilters: () => set({ filters: {} }),
    setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
    toggleSelected: (key) => {
        const keys = new Set(get().selectedKeys);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        set({ selectedKeys: keys });
    },
    clearSelection: () => set({ selectedKeys: new Set() }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setTheme: (theme) => set({ theme }),
    addAIReport: (r) => set(s => ({ aiReports: [r, ...s.aiReports] })),
    setSavedViews: (savedViews) => set({ savedViews }),
    applyView: (view) => set({ filters: view.filters }),
    setActiveSprints: (activeSprints) => set({ activeSprints }),
    setLastSynced: (lastSynced) => set({ lastSynced }),
    setTotalIssues: (totalIssues) => set({ totalIssues }),
    setDemoMode: (demoMode) => set({ demoMode }),
}));

// ─── Derived selectors ─────────────────────────────────────────────────────────

export function useFilteredIssues() {
    const issues = useAppStore((state) => state.issues);
    const filters = useAppStore((state) => state.filters);
    return useMemo(() => filterIssues(issues, filters), [issues, filters]);
}
