import type { ButtonHTMLAttributes } from "react";

type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "glass" | "ghost";
  size?: ButtonSize;
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const glassStyle =
    "border border-zinc-200/80 bg-white/75 text-zinc-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] backdrop-blur-md hover:bg-white/95 hover:text-zinc-950 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800/85 dark:hover:text-white";

  const styles = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.18)] ring-1 ring-inset ring-white/15 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:ring-black/10",
    secondary: glassStyle,
    glass: glassStyle,
    ghost:
      "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
  };

  const sizes = {
    sm: "min-h-[36px] min-w-[36px] px-3 text-xs",
    md: "min-h-[44px] min-w-[44px] px-4 text-sm",
    lg: "min-h-[52px] min-w-[52px] px-6 text-base",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight transition-all duration-150 ease-out active:scale-[0.985] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
