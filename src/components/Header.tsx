import { ChangeEvent, useRef } from 'react';
import { User } from 'firebase/auth';
import { FileSpreadsheet, LogOut, Moon, RefreshCw, Sun, Upload } from 'lucide-react';
import { DataSourceMeta } from '../types/employee';
import { GoogleSignInButton } from './GoogleSignInButton';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onSyncSheet: () => void;
  onUploadCsv: (file: File) => void;
  isSyncing: boolean;
  dataMeta: DataSourceMeta | null;
  googleUser: User | null;
  hasAccessToken: boolean;
  isLoggingIn: boolean;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onOpenSheetsModal: () => void;
}

export function Header({
  isDark,
  onToggleTheme,
  onSyncSheet,
  onUploadCsv,
  isSyncing,
  dataMeta,
  googleUser,
  hasAccessToken,
  isLoggingIn,
  onGoogleLogin,
  onGoogleLogout,
  onOpenSheetsModal,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCsv(file);
      e.target.value = '';
    }
  };

  const formattedTime = dataMeta
    ? dataMeta.lastSyncedAt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111114] transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            width="30"
            height="28"
            viewBox="0 0 36 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            <path
              d="M18 2L32 9.5L34 21.5L24.5 31H11.5L2 21.5L4 9.5L18 2Z"
              fill="#FFC800"
              stroke="#F58220"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M18 3V30M18 14L8 10.5M18 14L28 10.5M18 21L6.5 20M18 21L29.5 20"
              stroke="#F58220"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 dark:text-white whitespace-nowrap shrink-0">
            Shell People Analytics
          </h1>
          {dataMeta && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 pl-3 border-l border-neutral-200 dark:border-neutral-800 whitespace-nowrap max-w-[380px] truncate">
              <span className="truncate">{dataMeta.sourceLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums shrink-0">{dataMeta.rowCount} records</span>
              {formattedTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums shrink-0">Synced {formattedTime}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload employee CSV file"
          />

          {hasAccessToken && googleUser ? (
            <>
              <button
                type="button"
                onClick={onOpenSheetsModal}
                className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58220]"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#F58220] shrink-0" aria-hidden="true" />
                <span>Drive Sheets</span>
              </button>

              <button
                type="button"
                onClick={onGoogleLogout}
                title={`Signed in as ${googleUser.email ?? googleUser.displayName ?? 'Google user'}`}
                aria-label="Sign out of Google"
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="hidden md:inline max-w-[130px] truncate">
                  {googleUser.email ?? googleUser.displayName}
                </span>
                <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </>
          ) : (
            <GoogleSignInButton onClick={onGoogleLogin} isLoading={isLoggingIn} />
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58220]"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={onSyncSheet}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FFC800] hover:bg-[#F5B800] disabled:opacity-60 text-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58220]"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] min-w-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58220]"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-[#FFC800] shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-neutral-700 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
