'use client';

import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { decisionOptionConsPrompts, decisionOptionProsPrompts } from '@/lib/pm-writing';
import { DecisionOptionInput } from '@/types/pm-os';

interface DecisionOptionsEditorProps {
    options: DecisionOptionInput[];
    onChange: (options: DecisionOptionInput[]) => void;
}

export default function DecisionOptionsEditor({
    options,
    onChange,
}: DecisionOptionsEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sheet-label">Options Considered</span>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onChange([
                        ...options,
                        {
                            optionTitle: '',
                            pros: null,
                            cons: null,
                            sortOrder: options.length,
                            isSelected: options.length === 0,
                        },
                    ])}
                >
                    Add Option
                </button>
            </div>

            {options.map((option, index) => (
                <div key={`${option.optionTitle}-${index}`} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <input
                            className="input"
                            value={option.optionTitle}
                            onChange={(event) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, optionTitle: event.target.value } : item))}
                            placeholder={`Option ${index + 1}`}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <input
                                type="radio"
                                checked={option.isSelected}
                                onChange={() => onChange(options.map((item, itemIndex) => ({ ...item, isSelected: itemIndex === index })))}
                            />
                            Selected
                        </label>
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => onChange(options.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })))}
                        >
                            Remove
                        </button>
                    </div>

                    <textarea
                        className="input"
                        rows={2}
                        value={option.pros || ''}
                        onChange={(event) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, pros: event.target.value || null } : item))}
                        placeholder="Pros"
                    />
                    <PmWritingPrompts
                        value={option.pros}
                        onChange={(pros) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, pros } : item))}
                        prompts={decisionOptionProsPrompts}
                        title="Pros Starters"
                        description="Write the customer, delivery, or strategic upside of this option."
                    />
                    <textarea
                        className="input"
                        rows={2}
                        value={option.cons || ''}
                        onChange={(event) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, cons: event.target.value || null } : item))}
                        placeholder="Cons"
                    />
                    <PmWritingPrompts
                        value={option.cons}
                        onChange={(cons) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, cons } : item))}
                        prompts={decisionOptionConsPrompts}
                        title="Cons Starters"
                        description="Capture the tradeoffs and downside clearly so the final choice is auditable."
                    />
                </div>
            ))}
        </div>
    );
}
