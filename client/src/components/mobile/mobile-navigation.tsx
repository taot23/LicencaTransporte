import { Link, useLocation } from "wouter";
import { Truck, FileText, ClipboardCheck, Home, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [location] = useLocation();
  
  // Definir os itens de navegação
  const navItems = [
    {
      name: "Início",
      href: "/",
      icon: Home,
      active: location === "/" || location === ""
    },
    {
      name: "Veículos",
      href: "/vehicles",
      icon: Truck,
      active: location.includes("/vehicles")
    },
    {
      name: "Nova",
      href: "/request-license",
      icon: FileText,
      active: location.includes("/request-license")
    },
    {
      name: "Acompanhar",
      href: "/track-license",
      icon: ClipboardCheck,
      active: location.includes("/track-license")
    },
    {
      name: "Emitidas",
      href: "/issued-licenses",
      icon: Clock,
      active: location.includes("/issued-licenses")
    }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-50">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href}
          className="no-underline"
        >
          <div className={cn(
            "flex flex-col items-center justify-center",
            "w-full px-1 py-2 rounded-lg",
            "transition-colors",
            item.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}>
            <item.icon className={cn(
              "h-5 w-5 mb-1",
              item.active ? "text-primary" : "text-muted-foreground"
            )} />
            <span className="text-xs font-medium">{item.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}