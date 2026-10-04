import { forwardRef, type SVGProps } from "react";

type PlaybookIconProps = SVGProps<SVGSVGElement> & { size?: number | string };

/** Monochrome navigation version of the uploaded strategy-clipboard artwork. */
export const PlaybookIcon = forwardRef<SVGSVGElement, PlaybookIconProps>(
  ({ size = 24, strokeWidth = 1.6, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M7.5 4.5H4.8a1.3 1.3 0 0 0-1.3 1.3v15.4a1.3 1.3 0 0 0 1.3 1.3h14.4a1.3 1.3 0 0 0 1.3-1.3V5.8a1.3 1.3 0 0 0-1.3-1.3h-2.7" />
      <path d="M10 3V2.3A1.3 1.3 0 0 1 11.3 1h1.4A1.3 1.3 0 0 1 14 2.3V3" />
      <rect x="7.5" y="3" width="9" height="4" rx="1.2" />
      <path d="m7.3 10.2 2.4 2.4m0-2.4-2.4 2.4m4.4 4 2.4 2.4m0-2.4-2.4 2.4" />
      <circle cx="15.5" cy="11.4" r="1.5" />
      <circle cx="8.5" cy="17.8" r="1.5" />
      <path d="m11.4 14.3 1.2-1.2" />
    </svg>
  ),
);

PlaybookIcon.displayName = "PlaybookIcon";