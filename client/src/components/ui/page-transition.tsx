import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Immediate transition for faster page loads
    setIsVisible(true);
  }, []);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FadeIn({ 
  children, 
  delay = 0, 
  className 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Remove artificial delays for faster page loads
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, Math.min(delay, 50)); // Max 50ms delay

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-opacity duration-500 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}