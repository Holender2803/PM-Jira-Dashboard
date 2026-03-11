'use client';
import { create } from 'zustand';
import { useMemo } from 'react';
import {
    JiraIssue,
    DashboardFilters,
    Sprint,
    AIReportResponse,
    SavedView,
    WorkflowGroup,
} from '@/types';
import { filterIssues } from '@/lib/filters';
import { enrichIssuesWithEpicSummaries } from '@/lib/issue-format';
import {
    normalizeWorkflowGroupFilter,
    WORKFLOW_GROUP_ORDER,
} from '@/lib/statusGroups';

const DEFAULT_WORKFLOW_GROUP_FILTER: WorkflowGroup[] = [...WORKFLOW_GROUP_ORDER];

interface AppState {
    // Issues
    issues: JiraIssue[];
    isLoading: boolean;
    lastSynced: string | null;
    totalIssues: number;
    demoMode: boolean;

    // Filters
    filters: DashboardFilters;
    workflowGroupFilter: WorkflowGroup[];
    activeSprints: Sprint[];
    selectedKeys: Set<string>;
    selectedDocTickets: string[];
    selectedDocAudiences: string[];

    // UI
    sidebarOpen: boolean;
    sidebarHidden: boolean;
    theme: 'dark' | 'light';
    storyPointsWarningDismissed: boolean;
    isPmGuideEnabled: boolean;

    // AI Reports
    aiReports: AIReportResponse[];
    hasUnreadSyncBriefing: boolean;

    // Saved Views
    savedViews: SavedView[];

    // Actions
    setIssues: (issues: JiraIssue[]) => void;
    setLoading: (v: boolean) => void;
    setFilters: (f: Partial<DashboardFilters>) => void;
    setWorkflowGroupFilter: (groups: WorkflowGroup[]) => void;
    resetFilters: () => void;
    setSelectedKeys: (keys: Set<string>) => void;
    setSelectedDocTickets: (keys: string[]) => void;
    setSelectedDocAudiences: (audiences: string[]) => void;
    toggleDocTicket: (key: string) => void;
    toggleDocAudience: (audience: string) => void;
    clearDocTicketSelection: () => void;
    toggleSelected: (key: string) => void;
    clearSelection: () => void;
    setSidebarOpen: (v: boolean) => void;
    setSidebarHidden: (v: boolean) => void;
    setTheme: (t: 'dark' | 'light') => void;
    togglePmGuide: () => void;
    dismissStoryPointsWarning: () => void;
    resetStoryPointsWarning: () => void;
    addAIReport: (r: AIReportResponse) => void;
    setSavedViews: (v: SavedView[]) => void;
    applyView: (view: SavedView) => void;
    setActiveSprints: (s: Sprint[]) => void;
    setLastSynced: (t: string | null) => void;
    setTotalIssues: (n: number) => void;
    setDemoMode: (v: boolean) => void;
    setHasUnreadSyncBriefing: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    issues: [],
    isLoading: false,
    lastSynced: null,
    totalIssues: 0,
    demoMode: false,
    filters: { groupFilter: DEFAULT_WORKFLOW_GROUP_FILTER },
    workflowGroupFilter: DEFAULT_WORKFLOW_GROUP_FILTER,
    activeSprints: [],
    selectedKeys: new Set(),
    selectedDocTickets: [],
    selectedDocAudiences: [],
    sidebarOpen: true,
    sidebarHidden: false,
    theme: 'dark',
    storyPointsWarningDismissed: false,
    isPmGuideEnabled: false,
    aiReports: [],
    hasUnreadSyncBriefing: false,
    savedViews: [],

    setIssues: (issues) => set({ issues: enrichIssuesWithEpicSummaries(issues) }),
    setLoading: (isLoading) => set({ isLoading }),
    setFilters: (f) =>
        set((state) => {
            const nextFilters = { ...state.filters, ...f };
            let nextWorkflowGroups = state.workflowGroupFilter;

            if (Object.prototype.hasOwnProperty.call(f, 'groupFilter')) {
                nextWorkflowGroups = normalizeWorkflowGroupFilter(f.groupFilter);
                nextFilters.groupFilter = nextWorkflowGroups;
            }

            return {
                filters: nextFilters,
                workflowGroupFilter: nextWorkflowGroups,
            };
        }),
    setWorkflowGroupFilter: (groups) =>
        set((state) => {
            const normalized = normalizeWorkflowGroupFilter(groups);
            return {
                workflowGroupFilter: normalized,
                filters: {
                    ...state.filters,
                    groupFilter: normalized,
                },
            };
        }),
    resetFilters: () =>
        set({
            filters: { groupFilter: DEFAULT_WORKFLOW_GROUP_FILTER },
            workflowGroupFilter: DEFAULT_WORKFLOW_GROUP_FILTER,
        }),
    setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
    setSelectedDocTickets: (selectedDocTickets) =>
        set({ selectedDocTickets: [...new Set(selectedDocTickets)] }),
    setSelectedDocAudiences: (selectedDocAudiences) =>
        set({ selectedDocAudiences: [...new Set(selectedDocAudiences)] }),
    toggleDocTicket: (key) =>
        set((state) => {
            if (state.selectedDocTickets.includes(key)) {
                return {
                    selectedDocTickets: state.selectedDocTickets.filter((ticketKey) => ticketKey !== key),
                };
            }
            return {
                selectedDocTickets: [...state.selectedDocTickets, key],
            };
        }),
    toggleDocAudience: (audience) =>
        set((state) => {
            if (state.selectedDocAudiences.includes(audience)) {
                return {
                    selectedDocAudiences: state.selectedDocAudiences.filter((item) => item !== audience),
                };
            }
            return {
                selectedDocAudiences: [...state.selectedDocAudiences, audience],
            };
        }),
    clearDocTicketSelection: () => set({ selectedDocTickets: [] }),
    toggleSelected: (key) => {
        const keys = new Set(get().selectedKeys);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        set({ selectedKeys: keys });
    },
    clearSelection: () => set({ selectedKeys: new Set() }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setSidebarHidden: (sidebarHidden) => set({ sidebarHidden }),
    setTheme: (theme) => set({ theme }),
    togglePmGuide: () =>
        set((state) => ({ isPmGuideEnabled: !state.isPmGuideEnabled })),
    dismissStoryPointsWarning: () => set({ storyPointsWarningDismissed: true }),
    resetStoryPointsWarning: () => set({ storyPointsWarningDismissed: false }),
    addAIReport: (r) => set(s => ({ aiReports: [r, ...s.aiReports] })),
    setSavedViews: (savedViews) => set({ savedViews }),
    applyView: (view) => {
        const normalized = normalizeWorkflowGroupFilter(view.filters.groupFilter);
        set({
            filters: {
                ...view.filters,
                groupFilter: normalized,
            },
            workflowGroupFilter: normalized,
        });
    },
    setActiveSprints: (activeSprints) => set({ activeSprints }),
    setLastSynced: (lastSynced) => set({ lastSynced }),
    setTotalIssues: (totalIssues) => set({ totalIssues }),
    setDemoMode: (demoMode) => set({ demoMode }),
    setHasUnreadSyncBriefing: (hasUnreadSyncBriefing) => set({ hasUnreadSyncBriefing }),
}));

// ─── Derived selectors ─────────────────────────────────────────────────────────

export function useFilteredIssues() {
    const issues = useAppStore((state) => state.issues);
    const filters = useAppStore((state) => state.filters);
    return useMemo(() => filterIssues(issues, filters), [issues, filters]);
}
