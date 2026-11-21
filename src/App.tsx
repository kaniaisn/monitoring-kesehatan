import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Link2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {AccuracyAuditSection} from './components/AccuracyAuditSection';
import {HealthCharts} from './components/HealthCharts';
import {StudentPriorityTable} from './components/StudentPriorityTable';
import {
  auditHealthData,
  parseHealthSpreadsheet,
  type ParsedHealthDashboard,
  type SyncHistoryEntry,
} from './lib/healthSheet';

const CHECK_INTERVAL_SECONDS = 30;
const STORAGE_KEY_URL = 'uks_sdit_sheet_url_v1';

interface SheetApiResponse {
  ok: boolean;
  sourceType?: 'local' | 'google_sheets' | 'csv_url';
  sourceLabel?: string;
  resolvedUrl?: string | null;
  fetchedAt?: string;
  latencyMs?: number;
  sha256?: string;
  csvText?: string;
  error?: string;
}

function formatTimeWib(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function App() {
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY_URL) || '';
    } catch {
      return '';
    }
  });
  const [draftUrl, setDraftUrl] = useState<string>(sheetUrl);
  const [isConnectorOpen, setIsConnectorOpen] = useState<boolean>(false);

  const [dashboard, setDashboard] = useState<ParsedHealthDashboard | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('Memuat sumber data...');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string>('');
  const [lastSha256, setLastSha256] = useState<string>('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [countdown, setCountdown] = useState<number>(CHECK_INTERVAL_SECONDS);
  const [isAutoCheckEnabled, setIsAutoCheckEnabled] = useState<boolean>(true);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [nutritionFilter, setNutritionFilter] = useState<string>('Semua');

  const previousHashRef = useRef<string>('');
  const isFetchingRef = useRef<boolean>(false);

  const fetchAndVerifySheet = useCallback(
    async (targetUrl: string, triggerReason: 'initial' | 'auto' | 'manual' | 'url-change') => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsSyncing(true);

      try {
        const endpoint =
          targetUrl.trim().length > 0
            ? `/api/sheet-data?url=${encodeURIComponent(targetUrl.trim())}`
            : '/api/sheet-data';

        const response = await fetch(endpoint, {cache: 'no-store'});
        const payload = (await response.json()) as SheetApiResponse;

        if (!response.ok || !payload.ok || !payload.csvText) {
          const errMessage =
            payload.error || 'Gagal menyinkronkan data dari Google Spreadsheet.';
          setSyncError(errMessage);
          setSyncHistory((prev) => [
            {
              id: `${Date.now()}-err`,
              timestamp: formatTimeWib(payload.fetchedAt || new Date().toISOString()),
              sourceLabel: targetUrl.trim() ? 'Google Spreadsheet' : 'Data Lokal',
              latencyMs: payload.latencyMs ?? 0,
              sha256Short: previousHashRef.current
                ? previousHashRef.current.slice(0, 10)
                : '-',
              changeDetected: false,
              accuracyStatus: 'fail',
              passedChecks: 0,
              totalChecks: 5,
              message: errMessage,
            },
            ...prev.slice(0, 19),
          ]);
          return;
        }

        const parsed = parseHealthSpreadsheet(payload.csvText);
        const audit = auditHealthData(parsed);
        const newHash = payload.sha256 || '';
        const prevHash = previousHashRef.current;
        const changeDetected = prevHash !== '' && prevHash !== newHash;

        previousHashRef.current = newHash;

        setDashboard(parsed);
        setSourceLabel(payload.sourceLabel || 'Spreadsheet Terhubung');
        setResolvedUrl(payload.resolvedUrl ?? null);
        setLastFetchedAt(payload.fetchedAt || new Date().toISOString());
        setLastSha256(newHash);
        setSyncError(null);

        let logMessage = 'Data terverifikasi sinkron dan akurat.';
        if (triggerReason === 'initial' || triggerReason === 'url-change') {
          logMessage = `Inisialisasi sumber data selesai (${parsed.priorityStudents.length} siswa prioritas).`;
        } else if (changeDetected) {
          logMessage = 'Pembaruan data terdeteksi pada Google Spreadsheet dan langsung diterapkan.';
        } else if (triggerReason === 'manual') {
          logMessage = 'Pemeriksaan manual selesai — tidak ada selisih data.';
        }

        setSyncHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: formatTimeWib(payload.fetchedAt || new Date().toISOString()),
            sourceLabel: payload.sourceLabel || 'Spreadsheet',
            latencyMs: payload.latencyMs ?? 0,
            sha256Short: newHash.slice(0, 10),
            changeDetected,
            accuracyStatus: audit.overallStatus,
            passedChecks: audit.passedCount,
            totalChecks: audit.totalChecks,
            message: logMessage,
          },
          ...prev.slice(0, 19),
        ]);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Koneksi ke server sinkronisasi terputus.';
        setSyncError(message);
      } finally {
        isFetchingRef.current = false;
        setIsInitialLoading(false);
        setIsSyncing(false);
        setCountdown(CHECK_INTERVAL_SECONDS);
      }
    },
    [],
  );

  // Initial load & when sheetUrl changes
  useEffect(() => {
    previousHashRef.current = '';
    fetchAndVerifySheet(sheetUrl, sheetUrl ? 'url-change' : 'initial');
  }, [sheetUrl, fetchAndVerifySheet]);

  // 30-second countdown & realtime auto-check loop
  useEffect(() => {
    if (!isAutoCheckEnabled) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchAndVerifySheet(sheetUrl, 'auto');
          return CHECK_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAutoCheckEnabled, sheetUrl, fetchAndVerifySheet]);

  const auditReport = useMemo(() => {
    if (!dashboard) return null;
    return auditHealthData(dashboard);
  }, [dashboard]);

  function handleApplySpreadsheetUrl(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = draftUrl.trim();
    try {
      if (cleaned) {
        window.localStorage.setItem(STORAGE_KEY_URL, cleaned);
      } else {
        window.localStorage.removeItem(STORAGE_KEY_URL);
      }
    } catch {
      // Ignore storage errors
    }
    setSheetUrl(cleaned);
    setIsConnectorOpen(false);
  }

  function handleResetDefaultSource() {
    setDraftUrl('');
    try {
      window.localStorage.removeItem(STORAGE_KEY_URL);
    } catch {
      // Ignore storage errors
    }
    setSheetUrl('');
    setIsConnectorOpen(false);
  }

  function handleSelectNutritionFromChart(category: string) {
    setNutritionFilter((prev) => (prev === category ? 'Semua' : category));
    const el = document.getElementById('tindak-lanjut');
    if (el) el.scrollIntoView({behavior: 'smooth'});
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#ringkasan"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            UKS SDIT H. Maksudi Temi
          </a>

          {/* Zone 2: Clean single-line text nav links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
            aria-label="Navigasi utama"
          >
            <a
              href="#ringkasan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Ringkasan
            </a>
            <a
              href="#grafik-kesehatan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Grafik Kesehatan
            </a>
            <a
              href="#tindak-lanjut"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Tindak Lanjut
            </a>
            <a
              href="#audit-akurasi"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Audit Akurasi
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsConnectorOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              {isConnectorOpen ? 'Tutup Panel Link' : 'Hubungkan Spreadsheet'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Google Spreadsheet Link Connector Drawer (Collapsible) */}
        {isConnectorOpen && (
          <section
            aria-label="Pengaturan Link Google Spreadsheet"
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sumber Link Google Spreadsheet
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tempel URL Google Spreadsheet yang dapat diakses publik (&ldquo;Siapa saja yang memiliki link dapat melihat&rdquo;) atau link CSV.
                </p>
              </div>
              {sheetUrl && (
                <button
                  type="button"
                  onClick={handleResetDefaultSource}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Gunakan Data Bawaan SDIT
                </button>
              )}
            </div>

            <form
              onSubmit={handleApplySpreadsheetUrl}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/ID_SPREADSHEET/edit#gid=0"
                aria-label="URL Google Spreadsheet"
                className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:bg-white"
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Terapkan & Sinkronkan
              </button>
            </form>

            {resolvedUrl && (
              <div className="text-xs text-slate-500 font-mono truncate">
                Endpoint CSV aktif: {resolvedUrl}
              </div>
            )}
          </section>
        )}

        {/* Workspace Context Header & Realtime 30s Bar */}
        <section id="ringkasan" className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Dashboard Monitoring Kesehatan Siswa
              </h1>
              <p className="text-sm text-slate-600">
                {dashboard?.subtitle ||
                  'SDIT H. Maksudi Temi • Rekapitulasi Pelayanan Kesehatan & Tindak Lanjut Medis UKS'}
              </p>
            </div>

            {/* Live 30s Verification Controls & Metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                {auditReport?.overallStatus === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="font-medium text-slate-900">
                  {auditReport
                    ? `Akurasi ${auditReport.passedCount}/${auditReport.totalChecks} Lolos`
                    : 'Memeriksa...'}
                </span>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="truncate max-w-[200px]" title={sourceLabel}>
                Sumber: {sourceLabel}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-700">
                {isAutoCheckEnabled
                  ? `Cek ulang 00:${String(countdown).padStart(2, '0')}`
                  : 'Auto-cek dijeda'}
              </span>
              {lastFetchedAt && (
                <>
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-500 hidden sm:inline">
                    Update {formatTimeWib(lastFetchedAt)}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => fetchAndVerifySheet(sheetUrl, 'manual')}
                disabled={isSyncing}
                title="Periksa akurasi dan tarik data terbaru sekarang"
                className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50 whitespace-nowrap ml-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Cek Sekarang
              </button>
            </div>
          </div>

          {/* Sync Error Notice (if any) */}
          {syncError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Sinkronisasi Spreadsheet Gagal: </span>
                  <span>{syncError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetDefaultSource}
                className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-md hover:bg-red-100 whitespace-nowrap self-start sm:self-auto"
              >
                Kembali ke Data Bawaan
              </button>
            </div>
          )}

          {/* Loading Skeleton or 6-Column KPI Strip */}
          {isInitialLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({length: 6}).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-lg p-4 h-28 animate-pulse"
                >
                  <div className="h-3 w-24 bg-slate-200 rounded-sm" />
                  <div className="h-7 w-14 bg-slate-200 rounded-sm mt-3" />
                  <div className="h-3 w-28 bg-slate-100 rounded-sm mt-3" />
                </div>
              ))}
            </div>
          ) : dashboard ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-white border border-slate-200 rounded-lg divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
              {dashboard.kpis.map((kpi) => {
                const isAttention =
                  kpi.label.toUpperCase().includes('ATENSI') ||
                  kpi.label.toUpperCase().includes('TINDAK LANJUT');
                const isPositive = kpi.label.toUpperCase().includes('GIZI BAIK');
                return (
                  <div key={kpi.id} className="p-4 flex flex-col justify-between">
                    <div className="text-xs font-medium text-slate-600">
                      {kpi.label
                        .toLowerCase()
                        .replace(/\b\w/g, (ch) => ch.toUpperCase())
                        .replace(/\bUks\b/g, 'UKS')}
                    </div>
                    <div
                      className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 ${
                        isPositive
                          ? 'text-emerald-700'
                          : isAttention
                            ? 'text-amber-700'
                            : 'text-slate-900'
                      }`}
                    >
                      {kpi.valueText}
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5 leading-snug">
                      {kpi.caption}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* Student Health Charts */}
        {dashboard && (
          <HealthCharts
            nutritionRows={dashboard.nutritionDistribution}
            healthIndicators={dashboard.healthIndicators}
            priorityStudents={dashboard.priorityStudents}
            onSelectNutritionFilter={handleSelectNutritionFromChart}
          />
        )}

        {/* Priority Students Table */}
        {dashboard && (
          <StudentPriorityTable
            students={dashboard.priorityStudents}
            nutritionFilter={nutritionFilter}
            onNutritionFilterChange={setNutritionFilter}
          />
        )}

        {/* Accuracy Audit & 30s Sync History */}
        {auditReport && (
          <AccuracyAuditSection
            audit={auditReport}
            history={syncHistory}
            countdownSeconds={countdown}
            isAutoCheckEnabled={isAutoCheckEnabled}
            isSyncing={isSyncing}
            lastSha256={lastSha256}
            onToggleAutoCheck={() => setIsAutoCheckEnabled((prev) => !prev)}
            onManualCheck={() => fetchAndVerifySheet(sheetUrl, 'manual')}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Unit Kesehatan Sekolah (UKS) · SDIT H. Maksudi Temi
          </span>
          <span>
            Sinkronisasi Google Spreadsheet &amp; validasi akurasi otomatis setiap 30 detik.
          </span>
        </div>
      </footer>
    </div>
  );
}
