import { RotateCcw } from 'lucide-react';
import { FilterState } from '../types/employee';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  departments: string[];
  locations: string[];
  employmentTypes: string[];
  genders: string[];
  filteredCount: number;
  totalCount: number;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  departments,
  locations,
  employmentTypes,
  genders,
  filteredCount,
  totalCount,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.department !== 'All' ||
    filters.location !== 'All' ||
    filters.employmentType !== 'All' ||
    filters.gender !== 'All' ||
    filters.attrition !== 'All';

  const selectClass =
    'w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#18181C] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F58220] transition-colors cursor-pointer';

  const labelClass = 'block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1';

  return (
    <section
      aria-label="Workforce Filters"
      className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-semibold text-neutral-900 dark:text-white">Workforce Filters</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            Showing <strong className="text-neutral-950 dark:text-white">{filteredCount}</strong> of {totalCount} employees
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label htmlFor="filter-department" className={labelClass}>
            Department
          </label>
          <select
            id="filter-department"
            value={filters.department}
            onChange={(e) => onChange({ ...filters, department: e.target.value })}
            className={selectClass}
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-location" className={labelClass}>
            Location
          </label>
          <select
            id="filter-location"
            value={filters.location}
            onChange={(e) => onChange({ ...filters, location: e.target.value })}
            className={selectClass}
          >
            <option value="All">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-employment" className={labelClass}>
            Employment Type
          </label>
          <select
            id="filter-employment"
            value={filters.employmentType}
            onChange={(e) => onChange({ ...filters, employmentType: e.target.value })}
            className={selectClass}
          >
            <option value="All">All Types</option>
            {employmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-gender" className={labelClass}>
            Gender
          </label>
          <select
            id="filter-gender"
            value={filters.gender}
            onChange={(e) => onChange({ ...filters, gender: e.target.value })}
            className={selectClass}
          >
            <option value="All">All Genders</option>
            {genders.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-attrition" className={labelClass}>
            Attrition Status
          </label>
          <select
            id="filter-attrition"
            value={filters.attrition}
            onChange={(e) =>
              onChange({ ...filters, attrition: e.target.value as FilterState['attrition'] })
            }
            className={selectClass}
          >
            <option value="All">All Statuses</option>
            <option value="No">Active (No)</option>
            <option value="Yes">Left (Yes)</option>
          </select>
        </div>
      </div>
    </section>
  );
}
