import { Button } from "@/components/Button";
import { SearchIcon } from "@/components/icons";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-[#0F1417]/85 px-6 py-16 text-center backdrop-blur-xl">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-400/10 text-green-400">
        <SearchIcon className="h-7 w-7" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-neutral-400">{description}</p>
      </div>
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
