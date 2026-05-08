
import * as React from "react";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Badge({
  className = "",
  variant = "default",
  ...props
}: Props) {
  const styles =
    variant === "default"
      ? "bg-slate-900 text-white border-slate-900"
      : variant === "secondary"
      ? "bg-slate-100 text-slate-900 border-slate-200"
      : "bg-white text-slate-700 border-slate-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles} ${className}`}
      {...props}
    />
  );
}
