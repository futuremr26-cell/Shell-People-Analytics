/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { AlertTriangle, BarChart3, Layers, Lightbulb, RefreshCw, Upload } from 'lucide-react';
import { DeepDiveTab } from './components/DeepDiveTab';
import { FilterBar } from './components/FilterBar';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { Header } from './components/Header';
import { InsightsTab } from './components/InsightsTab';
import { OverviewTab } from './components/OverviewTab';
import { SheetsWorkspaceModal } from './components/SheetsWorkspaceModal';
import { DataSourceMeta, Employee, FilterState, TabId } from './types/employee';
import {
  applyFilters,
  GOOGLE_SHEET_EDIT_URL,
  GOOGLE_SHEET_GVIZ_CSV_URL,
  scoreEmployees,
  SHEET_ID,
} from './utils/analytics';
import { parseEmployeeCsv } from './utils/csvParser';
import {
  clearCachedAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './utils/googleAuth';
import { getSpreadsheetMetadata, readSpreadsheetTab } from './utils/googleSheetsApi';

const DEFAULT_FILTERS: FilterState = {
  department: 'All',
  location: 'All',
  employmentType: 'All',
  gender: 'All',
  attrition: 'All',
};

const THEME_STORAGE_KEY = 'shell-people-analytics-theme';

interface ActiveGoogleSheetTarget {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string | null;
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [dataMeta, setDataMeta] = useState<DataSourceMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Google Workspace OAuth & Sheets state (in-memory token only)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [activeSheetTarget, setActiveSheetTarget] = useState<ActiveGoogleSheetTarget>({
    spreadsheetId: SHEET_ID,
    spreadsheetTitle: 'Shell UK Workforce Sheet',
    sheetTitle: null,
  });

  const fallbackUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      (user) => {
        setGoogleUser(user);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadFromGoogleSheetsApi = useCallback(
    async (
      spreadsheetId: string,
      spreadsheetTitle: string,
      sheetTitle: string | null,
      token: string
    ) => {
      let targetTab = sheetTitle;
      let resolvedTitle = spreadsheetTitle;

      if (!targetTab) {
        const meta = await getSpreadsheetMetadata(spreadsheetId, token);
        resolvedTitle = meta.title;
        targetTab = meta.sheets[0]?.title ?? null;
        if (!targetTab) {
          throw new Error('The selected Google Spreadsheet has no readable worksheet tabs.');
        }
      }

      const { employees, warnings } = await readSpreadsheetTab(spreadsheetId, targetTab, token);
      setRawEmployees(employees);
      setActiveSheetTarget({
        spreadsheetId,
        spreadsheetTitle: resolvedTitle,
        sheetTitle: targetTab,
      });
      setDataMeta({
        sourceType: 'google-sheets',
        sourceLabel: `Sheets API: ${resolvedTitle} (${targetTab})`,
        lastSyncedAt: new Date(),
        rowCount: employees.length,
      });
      if (warnings.length > 0) {
        setWarningMessage(`${warnings.length} row(s) skipped due to missing EmployeeID.`);
      }
      setFilters(DEFAULT_FILTERS);
    },
    []
  );

  const syncFromGoogleSheet = useCallback(async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const token = accessToken ?? getAccessToken();

      if (token) {
        await loadFromGoogleSheetsApi(
          activeSheetTarget.spreadsheetId,
          activeSheetTarget.spreadsheetTitle,
          activeSheetTarget.sheetTitle,
          token
        );
        return;
      }

      // Unauthenticated fallback for default public Google Sheet via gviz endpoint
      if (activeSheetTarget.spreadsheetId !== SHEET_ID) {
        throw new Error(
          'Sign in with Google to sync private or custom Drive spreadsheets.'
        );
      }

      const url = `${GOOGLE_SHEET_GVIZ_CSV_URL}&_t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Google Sheets returned HTTP ${response.status} (${response.statusText || 'Request failed'}). Sign in with Google to read private sheets or upload a CSV export.`
        );
      }

      const csvText = await response.text();
      const { employees, warnings } = parseEmployeeCsv(csvText);

      setRawEmployees(employees);
      setDataMeta({
        sourceType: 'google-sheets',
        sourceLabel: 'Google Sheets (Public)',
        lastSyncedAt: new Date(),
        rowCount: employees.length,
      });
      if (warnings.length > 0) {
        setWarningMessage(`${warnings.length} row(s) skipped due to missing EmployeeID.`);
      }
      setFilters(DEFAULT_FILTERS);
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? 'Network or CORS error while reaching Google Sheets. Check your connection, sign in with Google, or use the "Upload CSV" fallback.'
          : err instanceof Error
          ? err.message
          : 'Unable to read Google Sheet data.';
      if (msg.toLowerCase().includes('session expired')) {
        clearCachedAccessToken();
        setAccessToken(null);
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [accessToken, activeSheetTarget, loadFromGoogleSheetsApi]);

  useEffect(() => {
    syncFromGoogleSheet();
    // Initial load on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setAccessToken(result.accessToken);
      setIsSheetsModalOpen(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.';
      setErrorMessage(msg);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const handleGoogleLogout = useCallback(async () => {
    await logout();
    setAccessToken(null);
    setGoogleUser(null);
    setIsSheetsModalOpen(false);
  }, []);

  const handleLoadSheetTab = useCallback(
    async (spreadsheetId: string, spreadsheetTitle: string, sheetTitle: string) => {
      const token = accessToken ?? getAccessToken();
      if (!token) {
        throw new Error('Sign in with Google first to load Drive spreadsheets.');
      }
      setIsSyncing(true);
      setErrorMessage(null);
      setWarningMessage(null);
      try {
        await loadFromGoogleSheetsApi(spreadsheetId, spreadsheetTitle, sheetTitle, token);
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, loadFromGoogleSheetsApi]
  );

  const handleUploadCsv = useCallback(async (file: File) => {
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const text = await file.text();
      const { employees, warnings } = parseEmployeeCsv(text);

      setRawEmployees(employees);
      setDataMeta({
        sourceType: 'csv-upload',
        sourceLabel: `CSV: ${file.name}`,
        lastSyncedAt: new Date(),
        rowCount: employees.length,
      });
      if (warnings.length > 0) {
        setWarningMessage(`${warnings.length} row(s) skipped due to missing EmployeeID.`);
      }
      setFilters(DEFAULT_FILTERS);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Could not parse "${file.name}": ${err.message}`
          : `Could not read "${file.name}".`;
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const scoredEmployees = useMemo(() => scoreEmployees(rawEmployees), [rawEmployees]);

  const filterOptions = useMemo(() => {
    const uniqueSorted = (getter: (e: Employee) => string) =>
      Array.from(new Set(rawEmployees.map(getter).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );

    return {
      departments: uniqueSorted((e) => e.department),
      locations: uniqueSorted((e) => e.location),
      employmentTypes: uniqueSorted((e) => e.employmentType),
      genders: uniqueSorted((e) => e.gender),
    };
  }, [rawEmployees]);

  const filteredEmployees = useMemo(
    () => applyFilters(scoredEmployees, filters),
    [scoredEmployees, filters]
  );

  const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'deep-dive', label: 'Deep Dive', icon: Layers },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
  ];

  const activeSheetUrl =
    activeSheetTarget.spreadsheetId === SHEET_ID
      ? GOOGLE_SHEET_EDIT_URL
      : `https://docs.google.com/spreadsheets/d/${activeSheetTarget.spreadsheetId}/edit`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] dark:bg-[#0C0C0E] text-[#111111] dark:text-[#F5F5F4] transition-colors">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onSyncSheet={syncFromGoogleSheet}
        onUploadCsv={handleUploadCsv}
        isSyncing={isSyncing}
        dataMeta={dataMeta}
        googleUser={googleUser}
        hasAccessToken={Boolean(accessToken)}
        isLoggingIn={isLoggingIn}
        onGoogleLogin={handleGoogleLogin}
        onGoogleLogout={handleGoogleLogout}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {errorMessage && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3 max-w-3xl">
              <AlertTriangle
                className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Unable to load Google Sheet dataset
                </h2>
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <input
                ref={fallbackUploadRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleUploadCsv(f);
                    e.target.value = '';
                  }
                }}
              />
              {!accessToken && (
                <GoogleSignInButton onClick={handleGoogleLogin} isLoading={isLoggingIn} />
              )}
              <button
                type="button"
                onClick={syncFromGoogleSheet}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#FFC800] text-[#111111] hover:bg-[#F5B800] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry Sync</span>
              </button>
              <button
                type="button"
                onClick={() => fallbackUploadRef.current?.click()}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border border-red-300 dark:border-red-800 bg-white dark:bg-[#18181C] text-red-900 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload CSV</span>
              </button>
            </div>
          </div>
        )}

        {warningMessage && !errorMessage && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
            {warningMessage}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading workforce analytics">
            <div className="h-28 rounded-xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 animate-pulse"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 rounded-xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 animate-pulse" />
              <div className="h-80 rounded-xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 animate-pulse" />
            </div>
          </div>
        ) : rawEmployees.length === 0 ? (
          <div className="bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center space-y-4">
            <h2 className="text-lg font-bold text-neutral-950 dark:text-white">
              No workforce data loaded
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
              Sign in with Google to browse your Drive spreadsheets, sync the Shell UK Google Sheet, or upload a local CSV export.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!accessToken && (
                <GoogleSignInButton onClick={handleGoogleLogin} isLoading={isLoggingIn} />
              )}
              <button
                type="button"
                onClick={syncFromGoogleSheet}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFC800] text-[#111111] hover:bg-[#F5B800] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Sync Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => fallbackUploadRef.current?.click()}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Upload CSV</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
              departments={filterOptions.departments}
              locations={filterOptions.locations}
              employmentTypes={filterOptions.employmentTypes}
              genders={filterOptions.genders}
              filteredCount={filteredEmployees.length}
              totalCount={rawEmployees.length}
            />

            <div className="border-b border-neutral-200 dark:border-neutral-800">
              <nav
                className="flex items-center gap-2 overflow-x-auto pb-px"
                aria-label="Analytics Views"
                role="tablist"
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58220] ${
                        isActive
                          ? 'border-[#F58220] text-neutral-950 dark:text-white'
                          : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#F58220]' : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div role="tabpanel" aria-label={activeTab}>
              {activeTab === 'overview' && (
                <OverviewTab employees={filteredEmployees} isDark={isDark} />
              )}
              {activeTab === 'deep-dive' && (
                <DeepDiveTab employees={filteredEmployees} isDark={isDark} />
              )}
              {activeTab === 'insights' && (
                <InsightsTab employees={filteredEmployees} />
              )}
            </div>
          </>
        )}
      </main>

      <SheetsWorkspaceModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        accessToken={accessToken}
        onRequireAuth={handleGoogleLogin}
        onLoadSheetTab={handleLoadSheetTab}
        filteredEmployees={filteredEmployees}
      />

      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111114] mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>Shell People Analytics · UK Workforce Intelligence</span>
          <a
            href={activeSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
          >
            Source Google Sheet
          </a>
        </div>
      </footer>
    </div>
  );
}
