import { forwardRef, type SVGProps } from "react";

type PlaybookIconProps = SVGProps<SVGSVGElement> & { size?: number | string };

/** A strategy clipboard, using the same sizing and color conventions as our UI icons. */
export const PlaybookIcon = forwardRef<SVGSVGElement, PlaybookIconProps>(
  ({ size = 24, strokeWidth = 1.6, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 26"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8 5H3.5v18h17V5H16" />
      <path d="M8 7H6v13.5h12V7h-2" />
      <path d="M9.5 4a2.5 2.5 0 0 1 5 0H16v3.5H8V4h1.5Z" />
      <path d="m8.5 10.5 2 2m0-2-2 2M7.5 15l2 2m0-2-2 2m7 1.5 2 2m0-2-2 2" />
      <circle cx="15.5" cy="10.5" r="1.25" />
      <circle cx="9" cy="19.5" r="1.25" />
      <path d="M10.5 18c3.5-.8 5-2.2 5-4.3" />
      <path d="m15.5 12.8-1.2 2h2.4Z" fill="currentColor" stroke="none" />
    </svg>
  ),
);

PlaybookIcon.displayName = "PlaybookIcon";