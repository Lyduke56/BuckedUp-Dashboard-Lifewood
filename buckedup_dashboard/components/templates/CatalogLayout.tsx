import React from 'react';

interface CatalogLayoutProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  content: React.ReactNode;
}

export function CatalogLayout({ sidebar, header, content }: CatalogLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      {/* Sidebar - Hidden on mobile, shown on large screens */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-6 min-w-0">
        <header className="sticky top-4 z-20">
          {header}
        </header>
        
        <div className="flex-1">
          {content}
        </div>
      </main>
    </div>
  );
}
