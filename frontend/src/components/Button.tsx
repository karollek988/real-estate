interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
  const styles =
    variant === "primary"
      ? "bg-green-600 text-white hover:bg-green-500 hover:shadow-[0_6px_24px_-6px_rgba(74,222,128,0.5)] active:shadow-none"
      : "border border-white/10 bg-white/5 text-white hover:bg-white/10";

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
