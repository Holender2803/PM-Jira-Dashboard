'use client';

import { StakeholderRecord } from '@/types/pm-os';

interface StakeholderSelectProps {
    stakeholders: StakeholderRecord[];
    value: string | null;
    onChange: (value: string | null) => void;
    label?: string;
    allowEmpty?: boolean;
}

export default function StakeholderSelect({
    stakeholders,
    value,
    onChange,
    label = 'Stakeholder',
    allowEmpty = true,
}: StakeholderSelectProps) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="sheet-label">{label}</span>
            <select
                className="input"
                value={value || ''}
                onChange={(event) => onChange(event.target.value || null)}
            >
                {allowEmpty && <option value="">None</option>}
                {stakeholders.map((stakeholder) => (
                    <option key={stakeholder.id} value={stakeholder.id}>
                        {stakeholder.name}
                    </option>
                ))}
            </select>
        </label>
    );
}
