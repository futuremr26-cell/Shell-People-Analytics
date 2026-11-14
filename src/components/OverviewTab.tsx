import { useMemo } from 'react';
import { ChartConfiguration } from 'chart.js';
import { ScoredEmployee } from '../types/employee';
import {
  formatCompactGBP,
  formatGBP,
  groupByCategory,
  mean,
  median,
} from '../utils/analytics';
import { ChartCanvas, getChartThemeColors } from './ChartCanvas';
import { KpiCard } from './KpiCard';

interface OverviewTabProps {
  employees: ScoredEmployee[];
  isDark: boolean;
}

export function OverviewTab({ employees, isDark }: OverviewTabProps) {
  const theme = useMemo(() => getChartThemeColors(isDark), [isDark]);

  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.attrition === 'No');
    const leavers = employees.filter((e) => e.attrition === 'Yes');
    const attritionRate = total > 0 ? (leavers.length / total) * 100 : 0;
    const retentionShare = total > 0 ? (active.length / total) * 100 : 0;
    const incomes = employees.map((e) => e.monthlyIncomeGbp);
    const avgIncome = mean(incomes);
    const medIncome = median(incomes);
    const totalPayroll = incomes.reduce((s, v) => s + v, 0);
    const activePayroll = active.reduce((s, e) => s + e.monthlyIncomeGbp, 0);

    return {
      total,
      activeCount: active.length,
      leaverCount: leavers.length,
      attritionRate,
      retentionShare,
      avgIncome,
      medIncome,
      totalPayroll,
      activePayroll,
    };
  }, [employees]);

  const deptConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const stats = groupByCategory(employees, (e) => e.department);
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Active',
            data: stats.map((s) => s.active),
            backgroundColor: theme.shellYellow,
            borderRadius: 3,
          },
          {
            label: 'Left (Attrition)',
            data: stats.map((s) => s.left),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textPrimary, font: { size: 11 } },
          },
        },
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx === undefined) return '';
                const s = stats[idx];
                return `Total: ${s.total} · Attrition: ${s.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme]);

  const locationConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const stats = groupByCategory(employees, (e) => e.location);
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Active',
            data: stats.map((s) => s.active),
            backgroundColor: isDark ? '#F5F5F4' : '#18181B',
            borderRadius: 3,
          },
          {
            label: 'Left (Attrition)',
            data: stats.map((s) => s.left),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textPrimary, maxRotation: 35, minRotation: 0 },
          },
          y: {
            stacked: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
        },
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx === undefined) return '';
                const s = stats[idx];
                return `Site Total: ${s.total} · Attrition: ${s.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme, isDark]);

  const genderConfig = useMemo<ChartConfiguration<'doughnut'>>(() => {
    const stats = groupByCategory(employees, (e) => e.gender);
    const palette = [theme.shellYellow, isDark ? '#52525B' : '#18181B', theme.shellOrange];
    return {
      type: 'doughnut',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            data: stats.map((s) => s.total),
            backgroundColor: stats.map((_, i) => palette[i % palette.length]),
            borderColor: theme.surfaceBg,
            borderWidth: 2,
          },
        ],
      },
      options: {
        cutout: '64%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = stats[ctx.dataIndex];
                const share = employees.length > 0 ? (s.total / employees.length) * 100 : 0;
                return ` ${s.label}: ${s.total} (${share.toFixed(1)}%) · Attrition ${s.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme, isDark]);

  const empTypeConfig = useMemo<ChartConfiguration<'doughnut'>>(() => {
    const order = ['Full-Time', 'Part-Time', 'Contract'];
    const stats = groupByCategory(employees, (e) => e.employmentType, order).filter(
      (s) => s.total > 0
    );
    const colorMap: Record<string, string> = {
      'Full-Time': theme.shellYellow,
      'Part-Time': theme.shellOrange,
      Contract: isDark ? '#A1A1AA' : '#18181B',
    };
    return {
      type: 'doughnut',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            data: stats.map((s) => s.total),
            backgroundColor: stats.map((s) => colorMap[s.label] ?? theme.neutralSlate),
            borderColor: theme.surfaceBg,
            borderWidth: 2,
          },
        ],
      },
      options: {
        cutout: '64%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = stats[ctx.dataIndex];
                const share = employees.length > 0 ? (s.total / employees.length) * 100 : 0;
                return ` ${s.label}: ${s.total} (${share.toFixed(1)}%) · Attrition ${s.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme, isDark]);

  const hiringTrendConfig = useMemo<ChartConfiguration<'line'>>(() => {
    const yearMap = new Map<number, { total: number; active: number; left: number }>();
    for (const e of employees) {
      if (!e.hireYear) continue;
      const curr = yearMap.get(e.hireYear) ?? { total: 0, active: 0, left: 0 };
      curr.total += 1;
      if (e.attrition === 'Yes') curr.left += 1;
      else curr.active += 1;
      yearMap.set(e.hireYear, curr);
    }
    const years = Array.from(yearMap.keys()).sort((a, b) => a - b);

    return {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          {
            label: 'Total Hires',
            data: years.map((y) => yearMap.get(y)?.total ?? 0),
            borderColor: theme.shellYellow,
            backgroundColor: isDark ? 'rgba(255, 200, 0, 0.16)' : 'rgba(255, 200, 0, 0.25)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: theme.shellYellow,
            fill: true,
            tension: 0.25,
          },
          {
            label: 'Cohort Departures',
            data: years.map((y) => yearMap.get(y)?.left ?? 0),
            borderColor: theme.shellOrange,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 2.5,
            pointHoverRadius: 4,
            pointBackgroundColor: theme.shellOrange,
            tension: 0.25,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textMuted, maxTicksLimit: 12 },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
        },
        plugins: {
          legend: { position: 'top', align: 'end' },
        },
      },
    };
  }, [employees, theme, isDark]);

  const isEmpty = employees.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Headcount"
          value={kpis.total.toLocaleString('en-GB')}
          subtext={`${kpis.activeCount} active · ${kpis.leaverCount} left`}
          accent="yellow"
        />
        <KpiCard
          label="Attrition Rate"
          value={`${kpis.attritionRate.toFixed(1)}%`}
          subtext={`${kpis.leaverCount} recorded departures`}
          accent={kpis.attritionRate >= 20 ? 'orange' : 'neutral'}
        />
        <KpiCard
          label="Active Employees"
          value={kpis.activeCount.toLocaleString('en-GB')}
          subtext={`${kpis.retentionShare.toFixed(1)}% of filtered cohort`}
          accent="neutral"
        />
        <KpiCard
          label="Average Income"
          value={formatGBP(kpis.avgIncome)}
          subtext={`Median ${formatGBP(kpis.medIncome)} / mo`}
          accent="yellow"
        />
        <KpiCard
          label="Monthly Payroll"
          value={formatCompactGBP(kpis.totalPayroll)}
          subtext={`Active run-rate ${formatCompactGBP(kpis.activePayroll)}`}
          accent="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Department Headcount & Attrition
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Active vs Left
            </span>
          </div>
          <ChartCanvas
            config={deptConfig}
            isDark={isDark}
            heightClass="h-[340px]"
            ariaLabel="Bar chart of headcount and attrition by department"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              UK Site Location Breakdown
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Headcount by hub
            </span>
          </div>
          <ChartCanvas
            config={locationConfig}
            isDark={isDark}
            heightClass="h-[340px]"
            ariaLabel="Bar chart of headcount and attrition by UK location"
            isEmpty={isEmpty}
          />
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Gender Split
            </h2>
            <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
              n = {employees.length}
            </span>
          </div>
          <ChartCanvas
            config={genderConfig}
            isDark={isDark}
            heightClass="h-[260px]"
            ariaLabel="Doughnut chart of workforce gender split"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Employment Type
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Contract mix
            </span>
          </div>
          <ChartCanvas
            config={empTypeConfig}
            isDark={isDark}
            heightClass="h-[260px]"
            ariaLabel="Doughnut chart of employment types"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 md:col-span-2 lg:col-span-1">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Hiring Trend
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              By hire year
            </span>
          </div>
          <ChartCanvas
            config={hiringTrendConfig}
            isDark={isDark}
            heightClass="h-[260px]"
            ariaLabel="Line chart of annual hiring trend and cohort departures"
            isEmpty={isEmpty}
          />
        </section>
      </div>
    </div>
  );
}
