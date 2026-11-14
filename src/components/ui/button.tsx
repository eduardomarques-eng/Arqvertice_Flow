import type { ButtonHTMLAttributes } from "react";

type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: ButtonSize;
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-[#18181B] text-white hover:bg-[#27272A] shadow-sm",
    secondary: "border border-slate-200/60 bg-white text-slate-900 hover:bg-[#EDE5D8]/40 shadow-sm",
    ghost: "text-slate-600 hover:bg-[#EDE5D8]/50 hover:text-slate-900",
  };

  const sizes = {
    sm: "min-h-[36px] min-w-[36px] px-3 text-xs",
    md: "min-h-[44px] min-w-[44px] px-4 text-sm",
    lg: "min-h-[52px] min-w-[52px] px-6 text-base",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium tracking-tight transition-all duration-100 active:scale-[0.98] select-none focus-visible:ring-2 focus-visible:ring-[#18181B]/30 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
