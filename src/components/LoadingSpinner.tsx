import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  fullScreen?: boolean;
  /** When true with fullScreen, covers only the content area (not sidebar). Requires a relative parent. */
  contentAreaOnly?: boolean;
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  text,
  fullScreen = false,
  contentAreaOnly = false,
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg",
  };

  const spinner = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen ? "min-h-screen" : "py-8 sm:py-12",
        className
      )}
    >
      <div className="relative">
        <Loader2
          className={cn("animate-spin text-primary", sizeClasses[size])}
        />
      </div>
      {text && (
        <p
          className={cn(
            "text-muted-foreground font-medium",
            textSizeClasses[size]
          )}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    const positionClass = contentAreaOnly
      ? "absolute inset-0 min-h-full"
      : "fixed inset-0";
    return (
      <div className={cn(positionClass, "bg-background flex items-center justify-center z-50")}>
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2
              className={cn("animate-spin text-primary", sizeClasses[size])}
            />
          </div>
          {text && (
            <p
              className={cn(
                "text-muted-foreground font-medium",
                textSizeClasses[size]
              )}
            >
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  return spinner;
}

// Compact loading spinner for inline use
export function InlineLoadingSpinner({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
    </div>
  );
}

// Skeleton loader for content placeholders
export function LoadingSkeleton({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-md bg-muted",
            className || "h-20 w-full"
          )}
        />
      ))}
    </>
  );
}
