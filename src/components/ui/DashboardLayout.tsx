'use client';
import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import Sidebar from '@/components/ui/Sidebar';

async function fetchIssues() {
    const res = await fetch('/api/jira/issues', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch issues');
    return res.json();
}

async function fetchSavedViews() {
    const res = await fetch('/api/saved-views');
    if (!res.ok) return [];
    return res.json();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const {
        setIssues, setLoading, setLastSynced, setTotalIssues,
        setDemoMode, setActiveSprints, setSavedViews, demoMode, sidebarHidden,
    } = useAppStore();
    const [syncing, setSyncing] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchIssues();
            setIssues(data.issues || []);
            setLastSynced(data.lastSynced);
            setTotalIssues(data.total || data.issues?.length || 0);
            setDemoMode(data.demoMode || false);
            if (data.sprints) setActiveSprints(data.sprints);
        } catch (e) {
            console.error('Failed to load issues:', e);
        } finally {
            setLoading(false);
        }
    }, [setIssues, setLoading, setLastSynced, setTotalIssues, setDemoMode, setActiveSprints]);

    const loadViews = useCallback(async () => {
        try {
            const views = await fetchSavedViews();
            if (Array.isArray(views)) setSavedViews(views);
        } catch { }
    }, [setSavedViews]);

    useEffect(() => {
        loadData();
        loadViews();
    }, [loadData, loadViews]);

    const handleRefresh = async () => {
        if (demoMode) {
            await loadData();
            return;
        }
        setSyncing(true);
        try {
            await fetch('/api/sync', { method: 'POST' });
            await loadData();
        } catch (e) {
            console.error('Sync failed:', e);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="layout">
            {!sidebarHidden && <Sidebar onRefresh={handleRefresh} syncing={syncing} />}
            <div className="main-content">
                {children}
            </div>
        </div>
    );
}
