import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? "v2-btn-primary" : "v2-btn-secondary";
  return <button className={`v2-btn ${variantClass} ${className}`} {...rest} />;
}
