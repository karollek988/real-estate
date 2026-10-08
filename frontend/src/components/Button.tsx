interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /**
   * Where the button sits. "onGreen" (the default) is for the deep-green panels, such as the analysis card on
   * the landing page; "light" is for white and cream surfaces.
   */
  tone?: "onGreen" | "light";
}

const STYLES = {
  onGreen: {
    primary: "bg-ka-mint text-ka-green-950 hover:bg-ka-mint-bright",
    secondary: "border border-white/10 bg-white/5 text-white hover:bg-white/10",
  },
  light: {
    primary: "bg-ka-green-900 text-white shadow-[0_8px_18px_-10px_var(--color-ka-green-950)] hover:bg-ka-green-800",
    secondary: "border border-ka-line-strong bg-white text-ka-ink hover:bg-ka-sand",
  },
} as const;

export function Button({ variant = "primary", tone = "onGreen", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

  return <button className={`${base} ${STYLES[tone][variant]} ${className}`} {...props} />;
}
