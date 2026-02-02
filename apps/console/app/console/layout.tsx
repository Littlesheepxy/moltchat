import Link from 'next/link';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:block">
        <div className="p-6">
          <Link href="/" className="text-xl font-bold">
            MoltChat
          </Link>
        </div>
        <nav className="px-4 space-y-1">
          <Link
            href="/console/rooms"
            className="block px-4 py-2 rounded-md hover:bg-accent text-sm"
          >
            Rooms
          </Link>
          <Link
            href="/console/rooms/new"
            className="block px-4 py-2 rounded-md hover:bg-accent text-sm text-muted-foreground"
          >
            + New Room
          </Link>
        </nav>
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Phase 0 - Scaffold
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
