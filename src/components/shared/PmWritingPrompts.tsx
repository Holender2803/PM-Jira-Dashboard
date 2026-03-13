'use client';

import { PmWritingPrompt } from '@/lib/pm-writing';

interface PmWritingPromptsProps {
    prompts: PmWritingPrompt[];
    value?: string | null;
    onChange: (next: string) => void;
    title?: string;
    description?: string;
}

export default function PmWritingPrompts({
    prompts,
    value,
    onChange,
    title = 'Sentence Starters',
    description = 'Use PM-style wording as a starting point, then edit it for your situation.',
}: PmWritingPromptsProps) {
    const currentValue = value || '';

    return (
        <div
            className="card"
            style={{
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.18))',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                    }}
                >
                    {title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {description}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {prompts.map((prompt) => (
                    <div
                        key={prompt.label}
                        style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'rgba(15,23,42,0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)' }}>
                                {prompt.label}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => onChange(currentValue.trim()
                                        ? `${currentValue.trimEnd()}\n${prompt.text}`
                                        : prompt.text)}
                                >
                                    {currentValue.trim() ? 'Append' : 'Use starter'}
                                </button>
                                {currentValue.trim() && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => onChange(prompt.text)}
                                    >
                                        Replace
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                            {prompt.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
