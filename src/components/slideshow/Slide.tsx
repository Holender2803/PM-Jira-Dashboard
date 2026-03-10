'use client';
import { ReactNode } from 'react';

interface SlideProps {
    slideNumber: number;
    title: string;
    accentColor: string;
    children: ReactNode;
    speakerNotes: string;
    audience: string;
    editMode?: boolean;
    onSpeakerNotesChange?: (value: string) => void;
    onRegenerate?: () => void | Promise<void>;
    regenerating?: boolean;
}

export default function Slide({
    slideNumber,
    title,
    accentColor,
    children,
    speakerNotes,
    audience,
    editMode = true,
    onSpeakerNotesChange,
    onRegenerate,
    regenerating = false,
}: SlideProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
                style={{
                    background: '#0F1629',
                    border: '1px solid rgba(148,163,184,0.18)',
                    borderRadius: 14,
                    minHeight: 520,
                    padding: 24,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        right: 16,
                        top: 14,
                        fontSize: 12,
                        color: '#cbd5e1',
                        border: '1px solid rgba(148,163,184,0.35)',
                        borderRadius: 999,
                        padding: '4px 10px',
                        background: 'rgba(15,23,42,0.35)',
                        fontWeight: 600,
                    }}
                >
                    Slide {slideNumber}
                </div>

                <div>
                    <h2 style={{ fontSize: 34, color: '#f8fafc', lineHeight: 1.12, fontWeight: 700, marginRight: 92 }}>
                        {title}
                    </h2>
                    <div
                        style={{
                            marginTop: 10,
                            width: 140,
                            height: 4,
                            borderRadius: 999,
                            background: accentColor,
                        }}
                    />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {children}
                </div>
            </div>

            {editMode && (
                <div
                    style={{
                        border: '1px dashed rgba(148,163,184,0.35)',
                        borderRadius: 12,
                        padding: 12,
                        background: 'rgba(15,23,42,0.45)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 8,
                        }}
                    >
                        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                            🎤 Speaker Notes
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                                Audience: {audience}
                            </span>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { void onRegenerate?.(); }}
                                disabled={regenerating || !onRegenerate}
                            >
                                {regenerating ? 'Regenerating...' : 'Regenerate'}
                            </button>
                        </div>
                    </div>

                    <textarea
                        className="input"
                        value={speakerNotes}
                        onChange={(event) => onSpeakerNotesChange?.(event.target.value)}
                        style={{
                            minHeight: 110,
                            resize: 'vertical',
                            color: '#cbd5e1',
                            fontStyle: 'italic',
                            background: 'rgba(15,23,42,0.5)',
                        }}
                    />
                </div>
            )}
        </div>
    );
}
