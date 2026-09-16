import { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  // v3.0 — responsiveness pass. Shows a spinner and forces disabled,
  // so any consumer that already tracks its own busy/submitting state
  // (nearly every form in the app) gets consistent, immediate click
  // feedback just by passing that state through here.
  loading?: boolean;
}

export function Button({ variant = "primary", className = "", loading = false, disabled, children, ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? "v2-btn-primary" : "v2-btn-secondary";
  return (
    <button className={`v2-btn ${variantClass} ${loading ? "v2-btn-busy" : ""} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
