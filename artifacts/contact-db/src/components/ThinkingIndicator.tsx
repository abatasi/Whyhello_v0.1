import React from "react";
import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = Omit<React.SVGProps<SVGSVGElement>, "children"> & {
  label?: string;
  decorative?: boolean;
};

/** The supplied Whyhello breathing pulse, sized for inline or panel thinking states. */
export function ThinkingIndicator({
  className, label = "Whyhello is thinking", decorative = false, ...props
}: ThinkingIndicatorProps) {
  return (
    <svg
      {...props}
      viewBox="0 0 320 205"
      className={cn("whyhello-thinking-loader inline-block h-5 w-8 shrink-0 align-middle", className)}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-live={decorative ? undefined : "polite"}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <path className="seg s1" d="M20 18 H72 L105 184 H57 Z" fill="#76D84F" />
      <path className="seg s2" d="M105 184 H57 L129 18 H174 Z" fill="#22BED2" />
      <path className="seg s3" d="M129 18 H174 L207 184 H163 Z" fill="#76D84F" />
      <path className="seg s4" d="M163 184 L244 4 L292 21 L211 184 Z" fill="#19B9D5" />
      <path className="seg s5" d="M211 184 H299 A88 88 0 0 0 250 105 Z" fill="#F52535" />
    </svg>
  );
}
