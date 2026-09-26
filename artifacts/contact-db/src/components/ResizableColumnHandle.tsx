import { useRef, type PointerEvent } from "react";

const MAX_WIDTH = 720;

export function ResizableColumnHandle({
  label,
  width,
  minWidth = 90,
  onResize,
}: {
  label: string;
  width: number;
  minWidth?: number;
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const clamp = (value: number) => Math.max(minWidth, Math.min(MAX_WIDTH, value));

  const start = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = { pointerId: event.pointerId, x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    onResize(clamp(drag.current.width + event.clientX - drag.current.x));
  };

  const stop = (event: PointerEvent<HTMLSpanElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <span
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title={`Drag to resize ${label}; use arrow keys for precise adjustment`}
      className="group/resize absolute inset-y-0 right-0 z-40 flex w-3 translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={() => { drag.current = null; }}
      onClick={(event) => event.stopPropagation()}
      onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        onResize(clamp(width + (event.key === "ArrowRight" ? 10 : -10)));
      }}
    >
      <span aria-hidden="true" className="h-full w-px bg-primary opacity-0 transition-opacity group-hover/resize:opacity-100 group-focus-within/resize:opacity-100" />
    </span>
  );
}