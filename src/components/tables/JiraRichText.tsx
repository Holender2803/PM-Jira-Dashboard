'use client';

import { ReactNode } from 'react';

type AdfMark = {
    type?: string;
    attrs?: { href?: string };
};

type AdfNode = {
    type?: string;
    text?: string;
    attrs?: {
        level?: number;
    };
    marks?: AdfMark[];
    content?: AdfNode[];
};

function parseAdf(raw: string): AdfNode | null {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
        const parsed = JSON.parse(trimmed) as AdfNode;
        if (parsed && parsed.type === 'doc') return parsed;
    } catch {
        return null;
    }
    return null;
}

function applyMarks(textNode: ReactNode, marks?: AdfMark[]): ReactNode {
    if (!marks || marks.length === 0) return textNode;
    return marks.reduce<ReactNode>((acc, mark, index) => {
        if (mark.type === 'strong') return <strong key={`m-${index}`}>{acc}</strong>;
        if (mark.type === 'em') return <em key={`m-${index}`}>{acc}</em>;
        if (mark.type === 'underline') return <u key={`m-${index}`}>{acc}</u>;
        if (mark.type === 'strike') return <s key={`m-${index}`}>{acc}</s>;
        if (mark.type === 'code') {
            return (
                <code
                    key={`m-${index}`}
                    style={{
                        background: 'rgba(99,102,241,0.14)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 4,
                        padding: '1px 4px',
                    }}
                >
                    {acc}
                </code>
            );
        }
        if (mark.type === 'link' && mark.attrs?.href) {
            return (
                <a
                    key={`m-${index}`}
                    href={mark.attrs.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}
                >
                    {acc}
                </a>
            );
        }
        return acc;
    }, textNode);
}

function renderInlineContent(content: AdfNode[] = []): ReactNode[] {
    return content.map((child, i) => renderNode(child, i));
}

function renderNode(node: AdfNode, key: number | string): ReactNode {
    const children = renderInlineContent(node.content || []);

    switch (node.type) {
        case 'doc':
            return <div key={key}>{children}</div>;
        case 'paragraph':
            return <p key={key} style={{ marginBottom: 10 }}>{children.length > 0 ? children : <br />}</p>;
        case 'text':
            return <span key={key}>{applyMarks(node.text || '', node.marks)}</span>;
        case 'hardBreak':
            return <br key={key} />;
        case 'heading': {
            const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 3)));
            const style = { marginBottom: 8, marginTop: 12, fontSize: `${Math.max(14, 20 - level)}px` };
            if (level === 1) return <h1 key={key} style={style}>{children}</h1>;
            if (level === 2) return <h2 key={key} style={style}>{children}</h2>;
            if (level === 3) return <h3 key={key} style={style}>{children}</h3>;
            if (level === 4) return <h4 key={key} style={style}>{children}</h4>;
            if (level === 5) return <h5 key={key} style={style}>{children}</h5>;
            return <h6 key={key} style={style}>{children}</h6>;
        }
        case 'bulletList':
            return <ul key={key} style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ul>;
        case 'orderedList':
            return <ol key={key} style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ol>;
        case 'listItem':
            return <li key={key} style={{ marginBottom: 4 }}>{children}</li>;
        case 'blockquote':
            return (
                <blockquote
                    key={key}
                    style={{
                        borderLeft: '3px solid var(--border-hover)',
                        paddingLeft: 10,
                        margin: '8px 0 12px',
                        color: 'var(--text-secondary)',
                    }}
                >
                    {children}
                </blockquote>
            );
        case 'codeBlock':
            return (
                <pre
                    key={key}
                    style={{
                        background: 'rgba(15,23,42,0.45)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 10,
                        overflowX: 'auto',
                        marginBottom: 10,
                        fontSize: 12,
                    }}
                >
                    <code>{(node.content || []).map((n) => n.text || '').join('')}</code>
                </pre>
            );
        case 'rule':
            return <hr key={key} style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0' }} />;
        case 'table':
            return (
                <div key={key} style={{ overflowX: 'auto', marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>{children}</tbody>
                    </table>
                </div>
            );
        case 'tableRow':
            return <tr key={key}>{children}</tr>;
        case 'tableCell':
        case 'tableHeader':
            return (
                <td key={key} style={{ border: '1px solid var(--border)', padding: 8, verticalAlign: 'top' }}>
                    {children}
                </td>
            );
        default:
            return <span key={key}>{children}</span>;
    }
}

interface JiraRichTextProps {
    value: string;
}

export default function JiraRichText({ value }: JiraRichTextProps) {
    const adf = parseAdf(value);
    if (!adf) {
        return (
            <div style={{ whiteSpace: 'pre-wrap' }}>
                {value}
            </div>
        );
    }
    return <div>{renderNode(adf, 'root')}</div>;
}
