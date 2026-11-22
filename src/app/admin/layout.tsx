import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Operations | PraiseTiles',
  description: 'Real-time monitoring, moderation, tournament oversight, and content health for PraiseTiles.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#07080d] text-gray-100 antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {children}
    </div>
  );
}
