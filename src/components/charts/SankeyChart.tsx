'use client';

import { useMemo, useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { StatusTransitionDirection, StatusTransitionFlow } from '@/lib/analytics';
import { WorkflowGroup } from '@/types';
import {
    getStageIndexByGroup,
    normalizeWorkflowGroupFilter,
    WORKFLOW_GROUP_ORDER,
} from '@/lib/workflow-groups';

interface SankeyChartProps {
    flow: StatusTransitionFlow;
    minTransitions?: number;
    selectedGroups?: WorkflowGroup[];
    bottleneckMode?: boolean;
}

interface SankeyNodePayload {
    name: string;
    label?: string;
    group?: WorkflowGroup;
    isBottleneck?: boolean;
}

interface SankeyLinkPayload {
    id: string;
    source: number;
    target: number;
    value: number;
    direction: StatusTransitionDirection;
    fromLabel: string;
    toLabel: string;
}

interface SankeyLinkProps {
    sourceX?: number;
    targetX?: number;
    sourceY?: number;
    targetY?: number;
    sourceControlX?: number;
    targetControlX?: number;
    linkWidth?: number;
    payload?: SankeyLinkPayload;
    hoveredEdgeId?: string | null;
    onHover?: (edgeId: string | null) => void;
}

interface SankeyNodeProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: SankeyNodePayload;
}

function directionColor(direction: StatusTransitionDirection): string {
    if (direction === 'backward') return '#F59E0B';
    if (direction === 'lateral') return '#94a3b8';
    return '#3B82F6';
}

function TransitionLink(props: SankeyLinkProps) {
    const {
        sourceX = 0,
        targetX = 0,
        sourceY = 0,
        targetY = 0,
        sourceControlX = sourceX,
        targetControlX = targetX,
        linkWidth = 1,
        payload,
        hoveredEdgeId,
        onHover,
    } = props;

    const y0 = sourceY + linkWidth / 2;
    const y1 = targetY + linkWidth / 2;
    const path = `M${sourceX},${y0}C${sourceControlX},${y0} ${targetControlX},${y1} ${targetX},${y1}`;
    const direction = payload?.direction || 'forward';
    const isHovered = !!payload?.id && hoveredEdgeId === payload.id;
    const baseOpacity = direction === 'backward' ? 0.7 : 0.5;

    return (
        <path
            d={path}
            fill="none"
            stroke={directionColor(direction)}
            strokeOpacity={isHovered ? 1 : baseOpacity}
            strokeWidth={Math.max(1, linkWidth)}
            onMouseEnter={() => payload?.id && onHover?.(payload.id)}
            onMouseLeave={() => onHover?.(null)}
        />
    );
}

function TransitionNode(props: SankeyNodeProps) {
    const { x = 0, y = 0, width = 20, height = 14, payload } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={3}
                fill="#1f2937"
                stroke="rgba(99,102,241,0.42)"
            />
            {payload?.isBottleneck && (
                <line
                    x1={x + 1}
                    y1={y + 1}
                    x2={x + 1}
                    y2={y + height - 1}
                    stroke="#ef4444"
                    strokeWidth={3}
                />
            )}
            <text
                x={x + width + 7}
                y={y + height / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--text-secondary)"
            >
                {payload?.label || payload?.name || ''}
            </text>
        </g>
    );
}

interface SankeyTooltipProps {
    active?: boolean;
    payload?: Array<{ payload?: SankeyLinkPayload }>;
}

function SankeyTransitionTooltip({ active, payload }: SankeyTooltipProps) {
    if (!active || !payload?.length) return null;
    const link = payload[0]?.payload;
    if (!link) return null;

    return (
        <div
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                padding: '8px 10px',
            }}
        >
            {link.fromLabel} → {link.toLabel}: {link.value} transitions
        </div>
    );
}

export default function SankeyChart({
    flow,
    minTransitions = 3,
    selectedGroups = [...WORKFLOW_GROUP_ORDER],
    bottleneckMode = false,
}: SankeyChartProps) {
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

    const activeGroups = useMemo(
        () => normalizeWorkflowGroupFilter(selectedGroups),
        [selectedGroups]
    );

    const visibleTransitions = useMemo(
        () =>
            flow.transitions
                .filter(
                    (transition) =>
                        transition.count >= minTransitions &&
                        activeGroups.includes(transition.fromStatus as WorkflowGroup) &&
                        activeGroups.includes(transition.toStatus as WorkflowGroup)
                )
                .sort((a, b) => b.count - a.count),
        [activeGroups, flow.transitions, minTransitions]
    );

    const data = useMemo(() => {
        const orderedGroups = [...activeGroups].sort(
            (a, b) => getStageIndexByGroup(a) - getStageIndexByGroup(b)
        );

        const nodes = orderedGroups.map((group) => ({
            name: group,
            label: `${group} · ${flow.nodeTicketCounts[group] || 0} tickets`,
            group,
            isBottleneck: bottleneckMode && flow.bottleneckStatuses.includes(group),
        }));

        const nodeIndex = new Map<string, number>();
        nodes.forEach((node, index) => nodeIndex.set(node.group, index));

        const links: SankeyLinkPayload[] = [];
        visibleTransitions.forEach((transition, index) => {
            const fromGroup = transition.fromStatus;
            const toGroup = transition.toStatus;

            if (!nodeIndex.has(fromGroup) || !nodeIndex.has(toGroup)) return;
            if (fromGroup === toGroup) return;

            // Keep chart DAG-safe by orienting links from lower stage index to higher.
            const fromIndex = getStageIndexByGroup(fromGroup);
            const toIndex = getStageIndexByGroup(toGroup);
            if (fromIndex < 0 || toIndex < 0) return;

            const sourceGroup = fromIndex <= toIndex ? fromGroup : toGroup;
            const targetGroup = fromIndex <= toIndex ? toGroup : fromGroup;

            const source = nodeIndex.get(sourceGroup);
            const target = nodeIndex.get(targetGroup);
            if (source === undefined || target === undefined) return;

            links.push({
                id: `${transition.fromStatus}-${transition.toStatus}-${transition.count}-${index}`,
                source,
                target,
                value: transition.count,
                direction: transition.direction,
                fromLabel: transition.fromStatus,
                toLabel: transition.toStatus,
            });
        });

        return { nodes, links };
    }, [
        activeGroups,
        bottleneckMode,
        flow.bottleneckStatuses,
        flow.nodeTicketCounts,
        visibleTransitions,
    ]);

    if (visibleTransitions.length < 5) {
        return (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--text-secondary)]">
                Not enough transitions at this threshold/filter (minimum 5 edges). Lower &quot;Min transitions to show&quot; or broaden filters.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative h-[360px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                        <span style={{ width: 16, height: 2, background: '#3B82F6', opacity: 0.5 }} />
                        Forward flow
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span style={{ width: 16, height: 2, background: '#F59E0B', opacity: 0.7 }} />
                        Rework / backward
                    </span>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                        data={data}
                        nodePadding={16}
                        nodeWidth={20}
                        margin={{ top: 40, right: 185, bottom: 8, left: 10 }}
                        node={<TransitionNode />}
                        link={
                            <TransitionLink
                                hoveredEdgeId={hoveredEdgeId}
                                onHover={setHoveredEdgeId}
                            />
                        }
                        iterations={64}
                    >
                        <Tooltip content={<SankeyTransitionTooltip />} />
                    </Sankey>
                </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]">
                <strong>{flow.backwardTicketPercent}%</strong> of tickets experienced at least one backward transition.
            </div>
        </div>
    );
}
