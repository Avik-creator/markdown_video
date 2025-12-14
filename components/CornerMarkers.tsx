import { cn } from "@/lib/utils";

/**
 * Reusable corner markers component that displays animated corner indicators on hover
 * Used in HomeLink, ExperimentItem, BlogItem, and other interactive elements
 * 
 * @param variant - "animated" (default) for hover animations, "static" for always-visible corners
 */
interface CornerMarkersProps {
  variant?: "animated" | "static";
}

export default function CornerMarkers({ variant = "animated" }: CornerMarkersProps) {
  const containerClasses = cn(
    "absolute w-[10px] h-[10px]",
    variant === "animated"
      ? "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      : "opacity-100"
  );

  const lineClasses = cn(
    "bg-gray-500 dark:bg-neutral-500",
    variant === "animated"
      ? "transition-all duration-300 group-hover:scale-y-100 scale-y-0 group-hover:scale-x-100 scale-x-0 group-hover:shadow-[0_0_4px_rgba(107,114,128,0.4)] dark:group-hover:shadow-[0_0_4px_rgba(163,163,163,0.4)]"
      : "scale-y-100 scale-x-100 shadow-[0_0_4px_rgba(107,114,128,0.4)] dark:shadow-[0_0_4px_rgba(163,163,163,0.4)]"
  );

  return (
    <>
      {/* Top left */}
      <div className={cn(containerClasses, "left-[-6.25px] top-[-6.25px]", variant === "animated" && "delay-75")}>
        <div className={cn("absolute left-0 top-0 h-[10px] w-[0.5px]", lineClasses, "origin-top")} />
        <div className={cn("absolute left-0 top-0 h-[0.5px] w-[10px]", lineClasses, "origin-left")} />
      </div>
      {/* Top right */}
      <div className={cn(containerClasses, "right-[-6.25px] top-[-6.25px]", variant === "animated" && "delay-100")}>
        <div className={cn("absolute right-0 top-0 h-[10px] w-[0.5px]", lineClasses, "origin-top")} />
        <div className={cn("absolute right-0 top-0 h-[0.5px] w-[10px]", lineClasses, "origin-right")} />
      </div>
      {/* Bottom left */}
      <div className={cn(containerClasses, "left-[-6.25px] bottom-[-6.25px]", variant === "animated" && "delay-125")}>
        <div className={cn("absolute left-0 bottom-0 h-[10px] w-[0.5px]", lineClasses, "origin-bottom")} />
        <div className={cn("absolute left-0 bottom-0 h-[0.5px] w-[10px]", lineClasses, "origin-left")} />
      </div>
      {/* Bottom right */}
      <div className={cn(containerClasses, "bottom-[-6.25px] right-[-6.25px]", variant === "animated" && "delay-150")}>
        <div className={cn("absolute right-0 bottom-0 h-[10px] w-[0.5px]", lineClasses, "origin-bottom")} />
        <div className={cn("absolute right-0 bottom-0 h-[0.5px] w-[10px]", lineClasses, "origin-right")} />
      </div>
    </>
  );
}

