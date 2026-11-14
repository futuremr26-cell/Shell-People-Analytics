import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderSearch,
  Loader2,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { ScoredEmployee } from '../types/employee';
import { SHEET_ID } from '../utils/analytics';
import {
  DriveSpreadsheetFile,
  exportCohortToNewSheet,
  getSpreadsheetMetadata,
  listDriveSpreadsheets,
  SpreadsheetMetadata,
} from '../utils/googleSheetsApi';

interface SheetsWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  onRequireAuth: () => void;
  onLoadSheetTab: (spreadsheetId: string, spreadsheetTitle: string, sheetTitle: string) => Promise<void>;
  filteredEmployees: ScoredEmployee[];
}

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export function SheetsWorkspaceModal({
  isOpen,
  onClose,
  accessToken,
  onRequireAuth,
  onLoadSheetTab,
  filteredEmployees,
}: SheetsWorkspaceModalProps) {
  const [mode, setMode] = useState<'browse' | 'export'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [directIdInput, setDirectIdInput] = useState(SHEET_ID);

  const [selectedMeta, setSelectedMeta] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingTabData, setLoadingTabData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Export state + mandatory confirmation gate
  const [exportTitle, setExportTitle] = useState(
    `Shell People Analytics Export (${new Date().toISOString().slice(0, 10)})`
  );
  const [confirmingExport, setConfirmingExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{
    spreadsheetUrl: string;
    rowsWritten: number;
  } | null>(null);

  const fetchDriveFiles = useCallback(
    async (query = '') => {
      if (!accessToken) {
        onRequireAuth();
        return;
      }
      setLoadingFiles(true);
      setErrorMsg(null);
      try {
        const list = await listDriveSpreadsheets(accessToken, query);
        setFiles(list);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load Drive spreadsheets.');
      } finally {
        setLoadingFiles(false);
      }
    },
    [accessToken, onRequireAuth]
  );

  useEffect(() => {
    if (isOpen && accessToken && mode === 'browse') {
      fetchDriveFiles();
    }
    if (!isOpen) {
      setConfirmingExport(false);
      setExportSuccess(null);
      setErrorMsg(null);
    }
  }, [isOpen, accessToken, mode, fetchDriveFiles]);

  if (!isOpen) return null;

  const handleInspectSpreadsheet = async (rawIdOrUrl: string) => {
    if (!accessToken) {
      onRequireAuth();
      return;
    }
    const id = extractSpreadsheetId(rawIdOrUrl);
    if (!id) {
      setErrorMsg('Enter a valid Google Spreadsheet URL or ID.');
      return;
    }
    setLoadingMeta(true);
    setErrorMsg(null);
    try {
      const meta = await getSpreadsheetMetadata(id, accessToken);
      setSelectedMeta(meta);
      setSelectedTab(meta.sheets[0]?.title ?? '');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not inspect spreadsheet.');
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleImportSelectedTab = async () => {
    if (!selectedMeta || !selectedTab) return;
    setLoadingTabData(true);
    setErrorMsg(null);
    try {
      await onLoadSheetTab(selectedMeta.spreadsheetId, selectedMeta.title, selectedTab);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load spreadsheet tab.');
    } finally {
      setLoadingTabData(false);
    }
  };

  const handleConfirmExport = async () => {
    if (!accessToken) {
      onRequireAuth();
      return;
    }
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const res = await exportCohortToNewSheet(
        accessToken,
        exportTitle.trim() || 'Shell People Analytics Export',
        filteredEmployees
      );
      setExportSuccess({
        spreadsheetUrl: res.spreadsheetUrl,
        rowsWritten: res.rowsWritten,
      });
      setConfirmingExport(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export to Google Sheets failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheets-workspace-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#F58220] shrink-0" aria-hidden="true" />
            <h2
              id="sheets-workspace-title"
              className="text-base font-bold text-neutral-950 dark:text-white"
            >
              Google Sheets & Drive Workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google Sheets dialog"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('browse');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              mode === 'browse'
                ? 'border-[#F58220] text-neutral-950 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FolderSearch className="w-4 h-4" aria-hidden="true" />
            <span>Load Sheet from Drive</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('export');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              mode === 'export'
                ? 'border-[#F58220] text-neutral-950 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" aria-hidden="true" />
            <span>Export Filtered Cohort</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'browse' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="direct-sheet-id"
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  Open by Google Sheet URL or Spreadsheet ID
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="direct-sheet-id"
                    type="text"
                    value={directIdInput}
                    onChange={(e) => setDirectIdInput(e.target.value)}
                    placeholder="Paste spreadsheet URL or ID..."
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-mono bg-neutral-50 dark:bg-[#18181C] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 focus-visible:outline-2 focus-visible:outline-[#F58220]"
                  />
                  <button
                    type="button"
                    disabled={loadingMeta}
                    onClick={() => handleInspectSpreadsheet(directIdInput)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FFC800] hover:bg-[#F5B800] text-[#111111] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                  >
                    {loadingMeta ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    <span>Inspect Tabs</span>
                  </button>
                </div>
              </div>

              {selectedMeta && (
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#18181C] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Selected Spreadsheet
                      </div>
                      <div className="text-sm font-bold text-neutral-950 dark:text-white">
                        {selectedMeta.title}
                      </div>
                    </div>
                    <a
                      href={selectedMeta.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#C2410C] dark:text-[#FFC800] hover:underline"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="flex-1">
                      <label
                        htmlFor="sheet-tab-select"
                        className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                      >
                        Worksheet Tab ({selectedMeta.sheets.length} available)
                      </label>
                      <select
                        id="sheet-tab-select"
                        value={selectedTab}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141417] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700"
                      >
                        {selectedMeta.sheets.map((s) => (
                          <option key={s.sheetId} value={s.title}>
                            {s.title} ({s.rowCount} rows × {s.columnCount} cols)
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={loadingTabData || !selectedTab}
                      onClick={handleImportSelectedTab}
                      className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold bg-[#111111] dark:bg-white text-white dark:text-[#111111] hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {loadingTabData && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Load Tab Data</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Your Google Drive Spreadsheets
                  </span>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchDriveFiles(searchTerm);
                      }}
                      placeholder="Filter Drive files..."
                      className="w-full min-h-[34px] pl-8 pr-2.5 py-1 rounded-lg text-xs bg-neutral-50 dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700"
                    />
                  </div>
                </div>

                {loadingFiles ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading spreadsheets from Google Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                    No spreadsheets found in Drive matching your filter. You can still inspect any shared spreadsheet by ID above.
                  </div>
                ) : (
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl divide-y divide-neutral-200 dark:divide-neutral-800 max-h-56 overflow-y-auto">
                    {files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setDirectIdInput(f.id);
                          handleInspectSpreadsheet(f.id);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-[#1B1B20] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {f.name}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                            {f.id}
                          </div>
                        </div>
                        {f.modifiedTime && (
                          <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
                            {new Date(f.modifiedTime).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Create a new Google Sheet in your Drive containing the{' '}
                <strong className="text-neutral-950 dark:text-white font-mono tabular-nums">
                  {filteredEmployees.length}
                </strong>{' '}
                currently filtered employee records, including computed Flight-Risk Scores and Risk Tiers.
              </div>

              <div>
                <label
                  htmlFor="export-sheet-title"
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  New Google Spreadsheet Title
                </label>
                <input
                  id="export-sheet-title"
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  disabled={confirmingExport || isExporting}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-[#18181C] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700"
                />
              </div>

              {exportSuccess && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Exported {exportSuccess.rowsWritten} employee rows to Google Sheets</span>
                  </div>
                  <a
                    href={exportSuccess.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 underline underline-offset-2"
                  >
                    <span>Open spreadsheet in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {confirmingExport ? (
                <div
                  role="region"
                  aria-label="Confirm Google Sheets Export"
                  className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-3"
                >
                  <div className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Confirm creation of new Google Sheet?
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    This will create a new spreadsheet titled{' '}
                    <strong>&ldquo;{exportTitle.trim() || 'Shell People Analytics Export'}&rdquo;</strong>{' '}
                    in your Google Drive and write{' '}
                    <strong className="font-mono tabular-nums">{filteredEmployees.length}</strong>{' '}
                    employee rows (plus header row) into the <strong>People Analytics Export</strong> tab.
                  </p>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleConfirmExport}
                      className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FFC800] hover:bg-[#F5B800] text-[#111111] disabled:opacity-60 cursor-pointer"
                    >
                      {isExporting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isExporting ? 'Creating Sheet...' : 'Confirm & Create Sheet'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => setConfirmingExport(false)}
                      className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={filteredEmployees.length === 0}
                  onClick={() => {
                    setExportSuccess(null);
                    setConfirmingExport(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFC800] hover:bg-[#F5B800] text-[#111111] disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Review Export ({filteredEmployees.length} rows)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
