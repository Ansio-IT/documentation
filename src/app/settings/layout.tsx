
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - Retail Sales Portal',
  description: 'Manage application settings.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-grow p-4 bg-muted/30">
        {/* Removed inner div with container mx-auto */}
        {children}
    </div>
  );
}
