interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  accent?: 'yellow' | 'orange' | 'neutral' | 'danger';
}

export function KpiCard({ label, value, subtext, accent = 'neutral' }: KpiCardProps) {
  const accentBarClass =
    accent === 'yellow'
      ? 'bg-[#FFC800]'
      : accent === 'orange'
      ? 'bg-[#F58220]'
      : accent === 'danger'
      ? 'bg-red-600 dark:bg-red-500'
      : 'bg-neutral-900 dark:bg-neutral-200';

  return (
    <div className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 truncate">
          {label}
        </span>
        <span className={`w-6 h-1 rounded-full shrink-0 ${accentBarClass}`} aria-hidden="true" />
      </div>
      <div className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-950 dark:text-white font-mono tabular-nums leading-none">
        {value}
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums truncate">
        {subtext}
      </div>
    </div>
  );
}
