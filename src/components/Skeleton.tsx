"use client";

import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  label?: string;
};

export function Skeleton({
  className = "",
  width = "100%",
  height = "1rem",
  rounded = false,
  label = "Chargement",
}: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height,
    borderRadius: rounded ? "9999px" : undefined,
  };

  return <div aria-label={label} role="status" className={`naxa-skeleton ${className}`.trim()} style={style} />;
}
