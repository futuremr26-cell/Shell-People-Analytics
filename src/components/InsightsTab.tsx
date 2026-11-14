import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScoredEmployee } from '../types/employee';
import {
  FLIGHT_RISK_RULES,
  formatGBP,
  generateInsights,
  generateRecommendations,
  getWatchlist,
} from '../utils/analytics';

interface InsightsTabProps {
  employees: ScoredEmployee[];
}

export function InsightsTab({ employees }: InsightsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const findings = useMemo(() => generateInsights(employees), [employees]);
  const watchlist = useMemo(() => getWatchlist(employees, 10), [employees]);
  const recommendations = useMemo(() => generateRecommendations(employees), [employees]);

  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center">
        <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
          No employees match the active filters
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Broaden one or more filters above to regenerate workforce findings, flight-risk rankings, and HR actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="findings-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="findings-heading"
            className="text-lg font-bold text-neutral-950 dark:text-white"
          >
            Auto-Generated Workforce Findings
          </h2>
          <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            Computed dynamically from {employees.length} filtered records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {findings.map((finding) => {
            const metricColor =
              finding.severity === 'critical'
                ? 'text-[#C2410C] dark:text-[#F58220]'
                : finding.severity === 'warning'
                ? 'text-[#92400E] dark:text-[#FFC800]'
                : finding.severity === 'positive'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-neutral-900 dark:text-neutral-100';

            return (
              <article
                key={finding.id}
                className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-neutral-500 dark:text-neutral-400">
                      {finding.category}
                    </span>
                    <span className={`font-mono tabular-nums font-bold ${metricColor}`}>
                      {finding.metricValue}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white leading-snug">
                    {finding.headline}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {finding.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section
          aria-labelledby="watchlist-heading"
          className="xl:col-span-8 bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
        >
          <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2
                id="watchlist-heading"
                className="text-base font-semibold text-neutral-950 dark:text-white"
              >
                Top-10 Flight-Risk Watchlist
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {watchlist.mode === 'active'
                  ? 'Highest-scoring active employees ranked by the transparent 100-point risk model · Click a row to inspect point drivers'
                  : 'Filtered to departed employees — showing top-scoring leavers to validate scoring drivers'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
              Top {watchlist.employees.length}
            </span>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {watchlist.employees.map((emp, idx) => {
              const isOpen = expandedId === emp.employeeId;
              const topDrivers = [...emp.riskBreakdown]
                .filter((b) => b.points > 0)
                .sort((a, b) => b.points - a.points)
                .slice(0, 2);

              return (
                <div key={emp.employeeId} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : emp.employeeId)}
                    aria-expanded={isOpen}
                    className="w-full text-left px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-[#1B1B20] transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono tabular-nums text-xs font-bold w-6 text-neutral-400 dark:text-neutral-500 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-neutral-950 dark:text-white">
                            {emp.fullName}
                          </span>
                          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                            {emp.employeeId}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            · {emp.department} · {emp.location}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                          {emp.jobTitle} (L{emp.jobLevel}, {emp.employmentType}) ·{' '}
                          {formatGBP(emp.monthlyIncomeGbp)}/mo · Primary drivers:{' '}
                          {topDrivers.map((d) => `${d.label} (+${d.points})`).join(', ') || 'Baseline'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-auto">
                      <div className="text-right">
                        <div
                          className={`font-mono tabular-nums text-sm font-bold ${
                            emp.riskTier === 'High'
                              ? 'text-[#C2410C] dark:text-[#F58220]'
                              : emp.riskTier === 'Moderate'
                              ? 'text-[#92400E] dark:text-[#FFC800]'
                              : 'text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {emp.flightRiskScore}/100
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {emp.riskTier} Risk
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 bg-neutral-50/70 dark:bg-[#18181C] border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {emp.riskBreakdown.map((factor) => (
                        <div
                          key={factor.ruleId}
                          className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141417]"
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-neutral-800 dark:text-neutral-200">
                              {factor.label}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-[#C2410C] dark:text-[#FFC800]">
                              +{factor.points}/{factor.maxPoints}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                            {factor.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="xl:col-span-4 bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Transparent Scoring Rule
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Additive 0–100 index · High Risk ≥ 55 · Moderate ≥ 35
            </p>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {FLIGHT_RISK_RULES.map((rule) => (
              <div key={rule.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-neutral-900 dark:text-white">{rule.name}</span>
                  <span className="font-mono tabular-nums text-[#C2410C] dark:text-[#FFC800]">
                    Max {rule.maxPoints} pts
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  {rule.criteria}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section aria-labelledby="actions-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="actions-heading"
            className="text-lg font-bold text-neutral-950 dark:text-white"
          >
            Recommended HR Actions
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Prioritized by attrition leverage in current selection
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((action) => {
            const priorityClass =
              action.priority === 'Immediate'
                ? 'text-[#C2410C] dark:text-[#F58220]'
                : action.priority === 'Near-Term'
                ? 'text-[#92400E] dark:text-[#FFC800]'
                : 'text-neutral-600 dark:text-neutral-400';

            return (
              <div
                key={action.id}
                className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-mono font-bold ${priorityClass}`}>
                    {action.priority} Priority
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 truncate">
                    {action.targetCohort}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {action.title}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {action.rationale}
                </p>
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  Expected outcome: {action.expectedImpact}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
