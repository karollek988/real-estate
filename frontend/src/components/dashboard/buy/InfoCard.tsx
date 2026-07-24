interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export function InfoCard({ icon, title, children }: InfoCardProps) {
  return (
    <div className="card-interactive rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-400 [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-neutral-400">{children}</div>
    </div>
  );
}
