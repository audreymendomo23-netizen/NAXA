"use client";
import type { CSSProperties, ElementType, ReactNode } from "react";
export type ScrollMotionKind = "rise" | "parallax" | "zoom" | "stagger" | "pin" | "fade";
type ScrollItemProps = {
  children?: ReactNode; as?: ElementType; className?: string; motion?: ScrollMotionKind;
  speed?: number; from?: string | number; to?: string | number; start?: number; end?: number;
  style?: CSSProperties; [key: string]: unknown;
};
const length = (value: string | number | undefined) =>
  value === undefined ? undefined : typeof value === "number" ? String(value) + "px" : value;
export function ScrollItem({ children, as: Tag = "div", className = "", motion = "rise",
  speed, from, to, start, end, style, ...rest }: ScrollItemProps) {
  return <Tag {...rest} className={className || undefined} data-scroll={motion}
    data-speed={speed === undefined ? undefined : String(speed)} data-from={length(from)} data-to={length(to)}
    data-start={start === undefined ? undefined : String(start)} data-end={end === undefined ? undefined : String(end)}
    style={style}>{children}</Tag>;
}
export function ScrollScene({ children, className = "", length = 5, stickyClassName = "" }: {
  children: ReactNode; className?: string; length?: number; stickyClassName?: string;
}) {
  const sceneLength = Math.max(1, Math.min(12, length));
  return <section className={("naxa-scroll-scene " + className).trim()} data-scene=""
    data-scene-length={sceneLength} style={{ "--scroll-scene-length": sceneLength } as CSSProperties}>
    <div className={("naxa-scroll-scene-sticky " + stickyClassName).trim()} data-scroll-scene-sticky="">{children}</div>
  </section>;
}
export function ScrollStagger({ children, className = "", as: Tag = "div" }: {
  children: ReactNode; className?: string; as?: ElementType;
}) {
  return <Tag className={className || undefined} data-scroll-stagger="">{children}</Tag>;
}
