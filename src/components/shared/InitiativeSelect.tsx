'use client';

import { InitiativeRecord } from '@/types/pm-os';

interface InitiativeSelectProps {
    initiatives: InitiativeRecord[];
    value: string | null;
    onChange: (value: string | null) => void;
    label?: string;
    allowEmpty?: boolean;
}

export default function InitiativeSelect({
    initiatives,
    value,
    onChange,
    label = 'Initiative',
    allowEmpty = true,
}: InitiativeSelectProps) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
            <select
                className="input"
                value={value || ''}
                onChange={(event) => onChange(event.target.value || null)}
            >
                {allowEmpty && <option value="">None</option>}
                {initiatives.map((initiative) => (
                    <option key={initiative.id} value={initiative.id}>
                        {initiative.title}
                    </option>
                ))}
            </select>
        </label>
    );
}
