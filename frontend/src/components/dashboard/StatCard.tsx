import { CountUp } from "@/components/dashboard/CountUp";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="card-interactive rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ka-muted">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ka-sage/60 text-ka-green-700 [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ka-ink">
        <CountUp value={value} />
      </p>
    </div>
  );
}
