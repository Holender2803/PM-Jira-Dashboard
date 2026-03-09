import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'MDFM Analytics — Jira PM Dashboard',
    description: 'Product Manager analytics cockpit for the MDFM engineering team — sprint progress, work mix, bugs, aging, and AI summaries.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
