import { useMemo, useState } from 'react';
import { ChartConfiguration } from 'chart.js';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { ScoredEmployee } from '../types/employee';
import {
  formatGBP,
  formatTravelLabel,
  groupByAgeBand,
  groupByCategory,
  groupByTenureBand,
  HIGH_RISK_THRESHOLD,
  mean,
  median,
} from '../utils/analytics';
import { ChartCanvas, getChartThemeColors } from './ChartCanvas';
import { KpiCard } from './KpiCard';

interface DeepDiveTabProps {
  employees: ScoredEmployee[];
  isDark: boolean;
}

type SortKey =
  | 'employeeId'
  | 'fullName'
  | 'department'
  | 'location'
  | 'jobLevel'
  | 'yearsAtCompany'
  | 'yearsSinceLastPromotion'
  | 'monthlyIncomeGbp'
  | 'flightRiskScore'
  | 'attrition';

const PAGE_SIZE = 15;

export function DeepDiveTab({ employees, isDark }: DeepDiveTabProps) {
  const theme = useMemo(() => getChartThemeColors(isDark), [isDark]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('flightRiskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<ScoredEmployee | null>(null);

  const kpis = useMemo(() => {
    const total = employees.length;
    const avgTenure = mean(employees.map((e) => e.yearsAtCompany));
    const medTenure = median(employees.map((e) => e.yearsAtCompany));
    const femaleCount = employees.filter((e) => e.gender === 'Female').length;
    const femaleShare = total > 0 ? (femaleCount / total) * 100 : 0;
    const nonFtCount = employees.filter((e) => e.employmentType !== 'Full-Time').length;
    const nonFtShare = total > 0 ? (nonFtCount / total) * 100 : 0;
    const avgPromoGap = mean(employees.map((e) => e.yearsSinceLastPromotion));
    const stalledCount = employees.filter((e) => e.yearsSinceLastPromotion >= 4).length;

    const activeEmployees = employees.filter((e) => e.attrition === 'No');
    const riskPool = activeEmployees.length > 0 ? activeEmployees : employees;
    const highRiskCount = riskPool.filter((e) => e.flightRiskScore >= HIGH_RISK_THRESHOLD).length;
    const riskContext =
      activeEmployees.length > 0
        ? `Active staff scoring ≥${HIGH_RISK_THRESHOLD}/100`
        : `Leavers scoring ≥${HIGH_RISK_THRESHOLD}/100`;

    return {
      avgTenure,
      medTenure,
      femaleCount,
      femaleShare,
      nonFtCount,
      nonFtShare,
      avgPromoGap,
      stalledCount,
      highRiskCount,
      riskContext,
    };
  }, [employees]);

  const ageBandConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const bands = groupByAgeBand(employees);
    return {
      type: 'bar',
      data: {
        labels: bands.map((b) => b.label),
        datasets: [
          {
            type: 'bar',
            label: 'Active',
            data: bands.map((b) => b.active),
            backgroundColor: theme.shellYellow,
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Left',
            data: bands.map((b) => b.left),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: 'Attrition %',
            data: bands.map((b) => Number(b.attritionRate.toFixed(1))),
            borderColor: isDark ? '#F5F5F4' : '#111111',
            backgroundColor: isDark ? '#F5F5F4' : '#111111',
            borderWidth: 2,
            pointRadius: 3.5,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textPrimary },
          },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 50,
            grid: { display: false },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `${v}%`,
            },
          },
        },
        plugins: { legend: { position: 'top', align: 'end' } },
      },
    } as ChartConfiguration<'bar' | 'line'>;
  }, [employees, theme, isDark]);

  const tenureBandConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const bands = groupByTenureBand(employees);
    return {
      type: 'bar',
      data: {
        labels: bands.map((b) => b.label),
        datasets: [
          {
            type: 'bar',
            label: 'Active',
            data: bands.map((b) => b.active),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Left',
            data: bands.map((b) => b.left),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: 'Attrition %',
            data: bands.map((b) => Number(b.attritionRate.toFixed(1))),
            borderColor: theme.shellYellow,
            backgroundColor: theme.shellYellow,
            borderWidth: 2.5,
            pointRadius: 3.5,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textPrimary },
          },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 50,
            grid: { display: false },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `${v}%`,
            },
          },
        },
        plugins: { legend: { position: 'top', align: 'end' } },
      },
    } as ChartConfiguration<'bar' | 'line'>;
  }, [employees, theme, isDark]);

  const incomeByLevelConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const levels = [1, 2, 3, 4, 5];
    const avgVals = levels.map((lvl) => {
      const subset = employees.filter((e) => e.jobLevel === lvl);
      return subset.length > 0 ? Math.round(mean(subset.map((e) => e.monthlyIncomeGbp))) : 0;
    });
    const medVals = levels.map((lvl) => {
      const subset = employees.filter((e) => e.jobLevel === lvl);
      return subset.length > 0 ? Math.round(median(subset.map((e) => e.monthlyIncomeGbp))) : 0;
    });

    return {
      type: 'bar',
      data: {
        labels: levels.map((l) => `Level ${l}`),
        datasets: [
          {
            label: 'Mean Income (£)',
            data: avgVals,
            backgroundColor: theme.shellYellow,
            borderRadius: 4,
          },
          {
            label: 'Median Income (£)',
            data: medVals,
            backgroundColor: isDark ? '#52525B' : '#18181B',
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textPrimary } },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `£${Number(v).toLocaleString()}`,
            },
          },
        },
        plugins: { legend: { position: 'top', align: 'end' } },
      },
    };
  }, [employees, theme, isDark]);

  const incomeByDeptConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const stats = groupByCategory(employees, (e) => e.department).sort(
      (a, b) => b.avgIncome - a.avgIncome
    );
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Average Monthly Income (£)',
            data: stats.map((s) => Math.round(s.avgIncome)),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `£${Number(v).toLocaleString()}`,
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textPrimary, font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = stats[ctx.dataIndex];
                return ` Avg Pay: ${formatGBP(s.avgIncome)}/mo · Headcount: ${s.total}`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme]);

  const educationConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const order = ['Below College', 'College', "Bachelor's", "Master's", 'Doctorate'];
    const stats = groupByCategory(employees, (e) => e.education, order).filter(
      (s) => s.total > 0 || order.includes(s.label)
    );
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Headcount',
            data: stats.map((s) => s.total),
            backgroundColor: theme.shellYellow,
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textPrimary } },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx === undefined) return '';
                const s = stats[idx];
                return `Avg Pay: ${formatGBP(s.avgIncome)}/mo · Attrition: ${s.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme]);

  const travelConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const order = ['Non-Travel', 'Travel_Rarely', 'Travel_Frequently'];
    const stats = groupByCategory(employees, (e) => e.businessTravel, order);
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => formatTravelLabel(s.label)),
        datasets: [
          {
            type: 'bar',
            label: 'Active',
            data: stats.map((s) => s.active),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Left',
            data: stats.map((s) => s.left),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: 'Attrition %',
            data: stats.map((s) => Number(s.attritionRate.toFixed(1))),
            borderColor: theme.shellYellow,
            backgroundColor: theme.shellYellow,
            borderWidth: 2.5,
            pointRadius: 4,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textPrimary },
          },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted, precision: 0 },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 45,
            grid: { display: false },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `${v}%`,
            },
          },
        },
        plugins: { legend: { position: 'top', align: 'end' } },
      },
    } as ChartConfiguration<'bar' | 'line'>;
  }, [employees, theme, isDark]);

  const scatterConfig = useMemo<ChartConfiguration<'scatter'>>(() => {
    const activePts = employees
      .filter((e) => e.attrition === 'No')
      .map((e) => ({ x: e.yearsAtCompany, y: e.monthlyIncomeGbp, emp: e }));
    const leftPts = employees
      .filter((e) => e.attrition === 'Yes')
      .map((e) => ({ x: e.yearsAtCompany, y: e.monthlyIncomeGbp, emp: e }));

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Active',
            data: activePts,
            backgroundColor: theme.shellYellow,
            borderColor: isDark ? '#141417' : '#111111',
            borderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          {
            label: 'Left (Attrition)',
            data: leftPts,
            backgroundColor: theme.shellOrange,
            borderColor: isDark ? '#FFFFFF' : '#7C2D12',
            borderWidth: 1.2,
            pointRadius: 5.5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Years at Shell',
              color: theme.textMuted,
            },
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textMuted },
          },
          y: {
            title: {
              display: true,
              text: 'Monthly Income (£)',
              color: theme.textMuted,
            },
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textMuted,
              callback: (v) => `£${Number(v).toLocaleString()}`,
            },
          },
        },
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const raw = ctx.raw as { emp?: ScoredEmployee } | undefined;
                const emp = raw?.emp;
                if (!emp) return '';
                return `${emp.fullName} (${emp.employeeId}) · ${emp.department} · L${emp.jobLevel} · ${formatGBP(emp.monthlyIncomeGbp)}/mo · ${emp.yearsAtCompany} yrs · Risk ${emp.flightRiskScore}/100`;
              },
            },
          },
        },
      },
    };
  }, [employees, theme, isDark]);

  // Search & Sort Table
  const searchedAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? employees.filter(
          (e) =>
            e.employeeId.toLowerCase().includes(q) ||
            e.fullName.toLowerCase().includes(q) ||
            e.jobTitle.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q) ||
            e.location.toLowerCase().includes(q)
        )
      : employees;

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [employees, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(searchedAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = searchedAndSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'employeeId' || key === 'fullName' || key === 'department' || key === 'location'
          ? 'asc'
          : 'desc'
      );
    }
    setPage(1);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 shrink-0" aria-hidden="true" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#F58220] shrink-0" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#F58220] shrink-0" aria-hidden="true" />
    );
  };

  const isEmpty = employees.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Average Tenure"
          value={`${kpis.avgTenure.toFixed(1)} yrs`}
          subtext={`Median ${kpis.medTenure.toFixed(1)} yrs at Shell`}
          accent="yellow"
        />
        <KpiCard
          label="Female Share"
          value={`${kpis.femaleShare.toFixed(1)}%`}
          subtext={`${kpis.femaleCount} of ${employees.length} employees`}
          accent="neutral"
        />
        <KpiCard
          label="Non-Full-Time Share"
          value={`${kpis.nonFtShare.toFixed(1)}%`}
          subtext={`${kpis.nonFtCount} Part-Time or Contract`}
          accent="orange"
        />
        <KpiCard
          label="Years Since Promotion"
          value={`${kpis.avgPromoGap.toFixed(1)} yrs`}
          subtext={`${kpis.stalledCount} staff at 4+ yrs`}
          accent="neutral"
        />
        <KpiCard
          label="High Flight-Risk Count"
          value={kpis.highRiskCount.toLocaleString('en-GB')}
          subtext={kpis.riskContext}
          accent={kpis.highRiskCount > 0 ? 'orange' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Age Bands & Attrition Rate
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Headcount + % exit rate
            </span>
          </div>
          <ChartCanvas
            config={ageBandConfig as ChartConfiguration}
            isDark={isDark}
            heightClass="h-[280px]"
            ariaLabel="Combo chart of age bands and attrition rate"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Tenure Bands & Attrition Rate
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Years at Shell
            </span>
          </div>
          <ChartCanvas
            config={tenureBandConfig as ChartConfiguration}
            isDark={isDark}
            heightClass="h-[280px]"
            ariaLabel="Combo chart of tenure bands and attrition rate"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Monthly Income by Job Level
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Mean vs median GBP
            </span>
          </div>
          <ChartCanvas
            config={incomeByLevelConfig}
            isDark={isDark}
            heightClass="h-[280px]"
            ariaLabel="Bar chart of monthly income by job level"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Average Income by Department
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Monthly GBP
            </span>
          </div>
          <ChartCanvas
            config={incomeByDeptConfig}
            isDark={isDark}
            heightClass="h-[310px]"
            ariaLabel="Horizontal bar chart of average monthly income by department"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Education Profile
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Qualification mix
            </span>
          </div>
          <ChartCanvas
            config={educationConfig}
            isDark={isDark}
            heightClass="h-[260px]"
            ariaLabel="Bar chart of employee education distribution"
            isEmpty={isEmpty}
          />
        </section>

        <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Business Travel & Attrition
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Travel frequency impact
            </span>
          </div>
          <ChartCanvas
            config={travelConfig as ChartConfiguration}
            isDark={isDark}
            heightClass="h-[260px]"
            ariaLabel="Combo chart of business travel frequency and attrition"
            isEmpty={isEmpty}
          />
        </section>
      </div>

      <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Income vs Tenure Scatter
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Hover any employee point for compensation & risk details
          </span>
        </div>
        <ChartCanvas
          config={scatterConfig}
          isDark={isDark}
          heightClass="h-[320px]"
          ariaLabel="Scatter plot of monthly income versus tenure colored by attrition"
          isEmpty={isEmpty}
        />
      </section>

      <section className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Employee Directory & Risk Ledger
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Click any column header to sort · Select a row to inspect flight-risk breakdown
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID, name, role, dept, site..."
              aria-label="Search employee directory"
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-[#18181C] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F58220]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#18181C] text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                <th className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('employeeId')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                  >
                    <span>ID</span>
                    {renderSortIcon('employeeId')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('fullName')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                  >
                    <span>Employee</span>
                    {renderSortIcon('fullName')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('department')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                  >
                    <span>Department</span>
                    {renderSortIcon('department')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('location')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                  >
                    <span>Location</span>
                    {renderSortIcon('location')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('jobLevel')}
                    className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white ml-auto"
                  >
                    <span>Lvl</span>
                    {renderSortIcon('jobLevel')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('yearsAtCompany')}
                    className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white ml-auto"
                  >
                    <span>Tenure</span>
                    {renderSortIcon('yearsAtCompany')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('yearsSinceLastPromotion')}
                    className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white ml-auto"
                  >
                    <span>Promo Lag</span>
                    {renderSortIcon('yearsSinceLastPromotion')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('monthlyIncomeGbp')}
                    className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white ml-auto"
                  >
                    <span>Monthly Pay</span>
                    {renderSortIcon('monthlyIncomeGbp')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('flightRiskScore')}
                    className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white ml-auto"
                  >
                    <span>Flight Risk</span>
                    {renderSortIcon('flightRiskScore')}
                  </button>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('attrition')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                  >
                    <span>Status</span>
                    {renderSortIcon('attrition')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-10 px-4 text-center text-sm text-neutral-500 dark:text-neutral-400"
                  >
                    No employees match the active filters and search query.
                  </td>
                </tr>
              ) : (
                pageRows.map((emp) => (
                  <tr
                    key={emp.employeeId}
                    onClick={() => setSelectedEmployee(emp)}
                    className="hover:bg-neutral-50 dark:hover:bg-[#1B1B20] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap tabular-nums">
                      {emp.employeeId}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-neutral-950 dark:text-white">
                        {emp.fullName}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {emp.jobTitle} · {emp.employmentType}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {emp.department}
                    </td>
                    <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {emp.location}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                      L{emp.jobLevel}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                      {emp.yearsAtCompany} yrs
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                      {emp.yearsSinceLastPromotion} yrs
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-neutral-950 dark:text-white whitespace-nowrap">
                      {formatGBP(emp.monthlyIncomeGbp)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          emp.riskTier === 'High'
                            ? 'font-bold text-[#C2410C] dark:text-[#F58220]'
                            : emp.riskTier === 'Moderate'
                            ? 'font-semibold text-[#92400E] dark:text-[#FFC800]'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }
                      >
                        {emp.flightRiskScore}/100 ({emp.riskTier})
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-xs font-medium">
                      <span
                        className={
                          emp.attrition === 'Yes'
                            ? 'text-[#C2410C] dark:text-[#F58220] font-semibold'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {emp.attrition === 'Yes' ? 'Left' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-mono tabular-nums">
            {searchedAndSorted.length === 0
              ? '0 results'
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                  safePage * PAGE_SIZE,
                  searchedAndSorted.length
                )} of ${searchedAndSorted.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Prev</span>
            </button>
            <span className="font-mono tabular-nums px-2">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-detail-title"
          onClick={() => setSelectedEmployee(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  {selectedEmployee.employeeId} · {selectedEmployee.department} · {selectedEmployee.location}
                </p>
                <h3
                  id="employee-detail-title"
                  className="text-xl font-bold text-neutral-950 dark:text-white mt-1"
                >
                  {selectedEmployee.fullName}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {selectedEmployee.jobTitle} · Level {selectedEmployee.jobLevel} ·{' '}
                  {selectedEmployee.employmentType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                aria-label="Close employee details"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Monthly Pay</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-950 dark:text-white">
                  {formatGBP(selectedEmployee.monthlyIncomeGbp)}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Level Median</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-950 dark:text-white">
                  {formatGBP(selectedEmployee.levelMedianIncome)}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Tenure</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-950 dark:text-white">
                  {selectedEmployee.yearsAtCompany} yrs
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Flight Risk</div>
                <div className="font-mono tabular-nums font-bold text-[#C2410C] dark:text-[#F58220]">
                  {selectedEmployee.flightRiskScore} / 100
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                Transparent Flight-Risk Score Breakdown
              </div>
              {selectedEmployee.riskBreakdown.map((item) => (
                <div key={item.ruleId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {item.label}
                    </span>
                    <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      +{item.points} / {item.maxPoints} pts
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-[#F58220]"
                      style={{ width: `${(item.points / item.maxPoints) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
