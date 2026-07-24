interface DashboardSectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardSection({ title, action, children }: DashboardSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
