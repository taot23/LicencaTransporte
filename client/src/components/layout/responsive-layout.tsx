import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavigation } from "@/components/mobile/mobile-navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";

interface ResponsiveLayoutProps {
  children: ReactNode;
  title?: string;
}

export function ResponsiveLayout({ children, title }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title={title} />
        <main className="pt-16 pb-20 px-4">
          <div className="max-w-screen-lg mx-auto">
            {children}
          </div>
        </main>
        <MobileNavigation />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}