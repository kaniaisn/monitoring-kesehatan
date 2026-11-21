import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  AccuracyAuditReport,
  AuditRuleStatus,
  SyncHistoryEntry,
} from '../lib/healthSheet';

interface AccuracyAuditSectionProps {
  audit: AccuracyAuditReport;
  history: SyncHistoryEntry[];
  countdownSeconds: number;
  isAutoCheckEnabled: boolean;
  isSyncing: boolean;
  lastSha256: string;
  onToggleAutoCheck: () => void;
  onManualCheck: () => void;
}

function getStatusMeta(status: AuditRuleStatus) {
  if (status === 'pass') {
    return {
      label: 'Akurat',
      textClass: 'text-emerald-700',
      icon: CheckCircle2,
    };
  }
  if (status === 'warning') {
    return {
      label: 'Perlu Perhatian',
      textClass: 'text-amber-700',
      icon: AlertTriangle,
    };
  }
  return {
    label: 'Selisih Terdeteksi',
    textClass: 'text-red-700',
    icon: XCircle,
  };
}

export function AccuracyAuditSection({
  audit,
  history,
  countdownSeconds,
  isAutoCheckEnabled,
  isSyncing,
  lastSha256,
  onToggleAutoCheck,
  onManualCheck,
}: AccuracyAuditSectionProps) {
  const overallMeta = getStatusMeta(audit.overallStatus);
  const OverallIcon = overallMeta.icon;

  return (
    <section id="audit-akurasi" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Audit Akurasi Data & Sinkronisasi Realtime (30 Detik)
          </h2>
          <p className="text-sm text-slate-600">
            Validasi silang otomatis antara ringkasan KPI, tabel distribusi IMT/U, indikator UKS, dan daftar siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleAutoCheck}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {isAutoCheckEnabled
              ? `Jeda Auto-Cek (00:${String(countdownSeconds).padStart(2, '0')})`
              : 'Aktifkan Auto-Cek 30d'}
          </button>
          <button
            type="button"
            onClick={onManualCheck}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Memeriksa...' : 'Periksa Akurasi Sekarang'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 5-Rule Verification Matrix */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <h3 className="text-base font-semibold text-slate-900">
                  Hasil Pemeriksaan Konsistensi Data
                </h3>
              </div>
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${overallMeta.textClass}`}>
                <OverallIcon className="w-4 h-4 shrink-0" />
                <span className="font-mono tabular-nums">
                  {audit.passedCount}/{audit.totalChecks} Aturan Lolos ({audit.accuracyScorePercent}%)
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {audit.checks.map((rule) => {
                const meta = getStatusMeta(rule.status);
                const RuleIcon = meta.icon;
                return (
                  <div key={rule.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {rule.title}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{rule.detail}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs font-mono tabular-nums text-slate-600">
                        <span>Target: {rule.expected}</span>
                        <span className="text-slate-300" aria-hidden="true">|</span>
                        <span>Aktual: {rule.actual}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${meta.textClass}`}
                    >
                      <RuleIcon className="w-3.5 h-3.5 shrink-0" />
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Sidik jari data (SHA-256)</span>
            <span className="font-mono tabular-nums text-slate-700">
              {lastSha256 ? lastSha256.slice(0, 16) : '-'}
            </span>
          </div>
        </div>

        {/* Right: 30-Second Sync History Log */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Riwayat Pengecekan Berkala
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Interval otomatis setiap 30 detik
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {history.length} siklus
              </span>
            </div>

            {history.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Menunggu siklus pengecekan pertama...
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-1 max-h-[340px] overflow-y-auto pr-1">
                {history.map((entry) => {
                  const meta = getStatusMeta(entry.accuracyStatus);
                  return (
                    <div key={entry.id} className="py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono tabular-nums font-medium text-slate-900">
                          {entry.timestamp}
                        </span>
                        <span className={`font-medium ${meta.textClass}`}>
                          {meta.label} ({entry.passedChecks}/{entry.totalChecks})
                        </span>
                      </div>
                      <div className="text-slate-600">{entry.message}</div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                        <span>Hash: {entry.sha256Short}</span>
                        <span>{entry.latencyMs} ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 text-xs text-slate-500">
            Perubahan di Google Spreadsheet otomatis terdeteksi melalui perbandingan hash SHA-256 dan pembaruan KPI.
          </div>
        </div>
      </div>
    </section>
  );
}
