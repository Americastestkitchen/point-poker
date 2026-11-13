import type { HTMLAttributes, Ref } from "react";
import { cx } from "./cx.ts";
import s from "./ScrollArea.module.css";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** The tallest it gets before it scrolls, as CSS (`"40vh"`, `"240px"`). Unset: it fills its box. */
  maxHeight?: string;
  /** Read out by screen readers; also makes it a Tab stop so the keyboard can scroll it. */
  label?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A region that scrolls with the kit's thin gold rail instead of the browser's scrollbar, and
 * keeps the scroll to itself (it doesn't drag the page or the game behind it).
 */
export function ScrollArea({ maxHeight, label, className, style, children, ref, ...rest }: ScrollAreaProps) {
  return (
    <div
      {...rest}
      ref={ref}
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cx(s.area, className)}
      style={maxHeight ? { ...style, maxHeight } : style}
    >
      {children}
    </div>
  );
}
