import { DashboardProvider } from "@/contexts/DashboardContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="max-w-[1180px] px-[30px] py-[26px] pb-[60px]">
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
