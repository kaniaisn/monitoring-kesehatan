import {useMemo, useState} from 'react';
import {AlertTriangle, CheckCircle2, Clock, Stethoscope} from 'lucide-react';
import type {
  HealthIndicatorRow,
  NutritionRow,
  PriorityStudent,
} from '../lib/healthSheet';

interface HealthChartsProps {
  nutritionRows: NutritionRow[];
  healthIndicators: HealthIndicatorRow[];
  priorityStudents: PriorityStudent[];
  onSelectNutritionFilter?: (category: string) => void;
}

const NUTRITION_COLORS: Record<string, {stroke: string; bar: string; text: string}> = {
  'Gizi Baik (Normal)': {
    stroke: '#16A34A',
    bar: 'bg-emerald-600',
    text: 'text-emerald-700',
  },
  'Gizi Lebih': {
    stroke: '#D97706',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
  },
  'Gizi Kurang': {
    stroke: '#EA580C',
    bar: 'bg-orange-600',
    text: 'text-orange-700',
  },
  Obesitas: {
    stroke: '#DC2626',
    bar: 'bg-red-600',
    text: 'text-red-700',
  },
};

function getNutritionColor(category: string) {
  if (NUTRITION_COLORS[category]) return NUTRITION_COLORS[category];
  if (category.toLowerCase().includes('baik')) return NUTRITION_COLORS['Gizi Baik (Normal)'];
  if (category.toLowerCase().includes('lebih')) return NUTRITION_COLORS['Gizi Lebih'];
  if (category.toLowerCase().includes('kurang')) return NUTRITION_COLORS['Gizi Kurang'];
  if (category.toLowerCase().includes('obesitas')) return NUTRITION_COLORS.Obesitas;
  return {stroke: '#0F766E', bar: 'bg-teal-700', text: 'text-teal-700'};
}

export function HealthCharts({
  nutritionRows,
  healthIndicators,
  priorityStudents,
  onSelectNutritionFilter,
}: HealthChartsProps) {
  const [hoveredNutrition, setHoveredNutrition] = useState<string | null>(null);
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(null);

  const categories = useMemo(
    () => nutritionRows.filter((row) => !row.isTotal),
    [nutritionRows],
  );
  const totalNutritionCount = useMemo(
    () => categories.reduce((sum, row) => sum + row.count, 0),
    [categories],
  );

  // Build SVG Donut segments (radius = 68, circumference = 2 * pi * 68)
  const donutRadius = 68;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const donutSegments = useMemo(() => {
    let accumulatedOffset = 0;
    return categories.map((item) => {
      const ratio = totalNutritionCount > 0 ? item.count / totalNutritionCount : 0;
      const dashLength = ratio * donutCircumference;
      const segment = {
        ...item,
        dashArray: `${dashLength} ${donutCircumference - dashLength}`,
        dashOffset: -accumulatedOffset,
        color: getNutritionColor(item.category),
      };
      accumulatedOffset += dashLength;
      return segment;
    });
  }, [categories, totalNutritionCount, donutCircumference]);

  const activeNutritionItem = useMemo(
    () => categories.find((c) => c.category === hoveredNutrition) ?? null,
    [categories, hoveredNutrition],
  );

  // Aggregate priority students by Class Level (Kelas 1..6)
  const classBreakdown = useMemo(() => {
    const levels = ['1', '2', '3', '4', '5', '6'];
    return levels.map((lvl) => {
      const students = priorityStudents.filter((s) => s.className.startsWith(lvl));
      const rujukan = students.filter((s) =>
        s.handlingStatus.toLowerCase().includes('rujukan'),
      ).length;
      const tindakLanjut = students.filter((s) =>
        s.handlingStatus.toLowerCase().includes('tindak lanjut'),
      ).length;
      const proses = students.filter((s) =>
        s.handlingStatus.toLowerCase().includes('proses'),
      ).length;
      const selesai = students.filter((s) =>
        s.handlingStatus.toLowerCase().includes('selesai'),
      ).length;
      return {
        label: `Kelas ${lvl}`,
        total: students.length,
        rujukan,
        tindakLanjut,
        proses,
        selesai,
      };
    });
  }, [priorityStudents]);

  const maxClassCount = Math.max(1, ...classBreakdown.map((c) => c.total));

  // Aggregate handling status summary
  const statusSummary = useMemo(() => {
    const groups = [
      {
        label: 'Perlu Rujukan',
        count: priorityStudents.filter((s) =>
          s.handlingStatus.toLowerCase().includes('rujukan'),
        ).length,
        barClass: 'bg-red-600',
        textClass: 'text-red-700',
        icon: AlertTriangle,
      },
      {
        label: 'Perlu Tindak Lanjut',
        count: priorityStudents.filter((s) =>
          s.handlingStatus.toLowerCase().includes('tindak lanjut'),
        ).length,
        barClass: 'bg-amber-500',
        textClass: 'text-amber-700',
        icon: Stethoscope,
      },
      {
        label: 'Dalam Proses',
        count: priorityStudents.filter((s) =>
          s.handlingStatus.toLowerCase().includes('proses'),
        ).length,
        barClass: 'bg-teal-600',
        textClass: 'text-teal-700',
        icon: Clock,
      },
      {
        label: 'Selesai',
        count: priorityStudents.filter((s) =>
          s.handlingStatus.toLowerCase().includes('selesai'),
        ).length,
        barClass: 'bg-emerald-600',
        textClass: 'text-emerald-700',
        icon: CheckCircle2,
      },
    ];
    return groups;
  }, [priorityStudents]);

  const parentContactedCount = useMemo(
    () =>
      priorityStudents.filter((s) =>
        s.parentContacted.toLowerCase().includes('sudah'),
      ).length,
    [priorityStudents],
  );

  return (
    <section id="grafik-kesehatan" className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Grafik Kesehatan Siswa
          </h2>
          <p className="text-sm text-slate-600">
            Visualisasi status gizi IMT/U, indikator pemeriksaan UKS, dan sebaran kasus prioritas per kelas.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500">
          Basis Data: {totalNutritionCount} siswa diperiksa · {priorityStudents.length} kasus prioritas
        </div>
      </div>

      {/* Row 1: Two main analytical charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart 1: Distribusi Status Gizi (IMT/U) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Distribusi Status Gizi (IMT/U)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Arahkan kursor atau klik kategori untuk memfilter tabel siswa
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                n = {totalNutritionCount}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 my-2">
              {/* Interactive SVG Donut */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 180 180"
                  className="w-full h-full -rotate-90"
                  role="img"
                  aria-label="Grafik donat distribusi status gizi siswa"
                >
                  <circle
                    cx="90"
                    cy="90"
                    r={donutRadius}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="22"
                  />
                  {donutSegments.map((seg) => {
                    const isDimmed =
                      hoveredNutrition !== null && hoveredNutrition !== seg.category;
                    return (
                      <circle
                        key={seg.category}
                        cx="90"
                        cy="90"
                        r={donutRadius}
                        fill="none"
                        stroke={seg.color.stroke}
                        strokeWidth={hoveredNutrition === seg.category ? 25 : 22}
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        className="transition-all duration-150 cursor-pointer"
                        style={{opacity: isDimmed ? 0.35 : 1}}
                        onMouseEnter={() => setHoveredNutrition(seg.category)}
                        onMouseLeave={() => setHoveredNutrition(null)}
                        onClick={() => onSelectNutritionFilter?.(seg.category)}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                  <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {activeNutritionItem ? activeNutritionItem.count : totalNutritionCount}
                  </span>
                  <span className="text-xs text-slate-600 leading-tight mt-0.5">
                    {activeNutritionItem
                      ? activeNutritionItem.percentText
                      : 'Total Siswa'}
                  </span>
                  {activeNutritionItem && (
                    <span className="text-[11px] font-medium text-slate-500 truncate max-w-[110px] mt-0.5">
                      {activeNutritionItem.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Category Breakdown List */}
              <div className="w-full space-y-3">
                {categories.map((item) => {
                  const color = getNutritionColor(item.category);
                  const isActive = hoveredNutrition === item.category;
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onMouseEnter={() => setHoveredNutrition(item.category)}
                      onMouseLeave={() => setHoveredNutrition(null)}
                      onClick={() => onSelectNutritionFilter?.(item.category)}
                      className={`w-full text-left py-1.5 px-2 rounded-md transition-colors ${
                        isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800 flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color.bar}`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.category}</span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-900 font-semibold shrink-0 ml-2">
                          {item.count} <span className="text-slate-500 font-normal">({item.percentText})</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mt-1 pl-4">
                        <span className="font-mono tabular-nums">IMT {item.imtRange}</span>
                        <span>{item.evaluation}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Standar rujukan IMT/U Kemenkes RI</span>
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              100,0% Terpantau
            </span>
          </div>
        </div>

        {/* Chart 2: Rekapitulasi Indikator Kesehatan Khusus & UKS */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Indikator Kesehatan Khusus & UKS
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perbandingan kondisi normal terhadap kasus yang memerlukan tindak lanjut medis
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" aria-hidden="true" />
                  Kondisi Normal
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" aria-hidden="true" />
                  Perlu Tindak Lanjut
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {healthIndicators.map((ind) => {
                const rowTotal = ind.normalCount + ind.followUpCount;
                const normalPct = rowTotal > 0 ? (ind.normalCount / rowTotal) * 100 : 0;
                const followPct = rowTotal > 0 ? (ind.followUpCount / rowTotal) * 100 : 0;
                const isHighPriority = ind.priority.toLowerCase() === 'tinggi';
                const isHovered = hoveredIndicator === ind.indicator;

                return (
                  <div
                    key={ind.indicator}
                    onMouseEnter={() => setHoveredIndicator(ind.indicator)}
                    onMouseLeave={() => setHoveredIndicator(null)}
                    className={`p-2.5 -mx-2.5 rounded-md transition-colors ${
                      isHovered ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-900">
                          {ind.indicator}
                        </span>
                        <span className="text-xs text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            isHighPriority ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          Prioritas {ind.priority}
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                        <span className="text-emerald-700 font-medium">{ind.normalCount} normal</span>
                        <span className="mx-1.5 text-slate-300">/</span>
                        <span className="text-amber-700 font-semibold">
                          {ind.followUpCount} tindak lanjut ({ind.problemPercentText})
                        </span>
                      </div>
                    </div>

                    {/* Stacked Horizontal Bar */}
                    <div
                      className="w-full h-3 bg-slate-100 rounded-sm overflow-hidden flex"
                      role="img"
                      aria-label={`${ind.indicator}: ${ind.normalCount} normal, ${ind.followUpCount} perlu tindak lanjut`}
                    >
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{width: `${normalPct}%`}}
                      />
                      <div
                        className={`h-full transition-all duration-300 ${
                          isHighPriority ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                        style={{width: `${followPct}%`}}
                      />
                    </div>

                    <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
                      <span>Tindak lanjut: {ind.mainAction}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        Total: {rowTotal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Catatan: Register Harian UKS dihitung dari 10 kunjungan harian</span>
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              {healthIndicators.length} Indikator Aktif
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Class distribution + Handling Status Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Bar Chart: Sebaran Kasus Prioritas per Tingkat Kelas */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Sebaran Kasus Prioritas per Tingkat Kelas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Jumlah siswa yang membutuhkan penanganan atau rujukan medis di tiap jenjang kelas
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Total {priorityStudents.length} siswa
            </span>
          </div>

          <div className="grid grid-cols-6 gap-3 sm:gap-5 items-end h-44 pt-4 pb-2 border-b border-slate-200">
            {classBreakdown.map((item) => {
              const heightPct = (item.total / maxClassCount) * 100;
              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center justify-end h-full group"
                >
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 mb-1.5">
                    {item.total}
                  </span>
                  <div className="w-full max-w-[44px] h-28 bg-slate-100 rounded-t-sm flex flex-col justify-end overflow-hidden">
                    {item.total > 0 && (
                      <div
                        className="w-full flex flex-col-reverse transition-all duration-300"
                        style={{height: `${heightPct}%`}}
                      >
                        {item.rujukan > 0 && (
                          <div
                            className="w-full bg-red-600"
                            style={{height: `${(item.rujukan / item.total) * 100}%`}}
                            title={`Perlu Rujukan: ${item.rujukan}`}
                          />
                        )}
                        {item.tindakLanjut > 0 && (
                          <div
                            className="w-full bg-amber-500"
                            style={{height: `${(item.tindakLanjut / item.total) * 100}%`}}
                            title={`Perlu Tindak Lanjut: ${item.tindakLanjut}`}
                          />
                        )}
                        {item.proses > 0 && (
                          <div
                            className="w-full bg-teal-600"
                            style={{height: `${(item.proses / item.total) * 100}%`}}
                            title={`Dalam Proses: ${item.proses}`}
                          />
                        )}
                        {item.selesai > 0 && (
                          <div
                            className="w-full bg-emerald-600"
                            style={{height: `${(item.selesai / item.total) * 100}%`}}
                            title={`Selesai: ${item.selesai}`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-6 gap-3 sm:gap-5 pt-2 text-center">
            {classBreakdown.map((item) => (
              <span key={item.label} className="text-xs font-medium text-slate-700">
                {item.label}
              </span>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-600" aria-hidden="true" />
              Perlu Rujukan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" aria-hidden="true" />
              Perlu Tindak Lanjut
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" aria-hidden="true" />
              Dalam Proses
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" aria-hidden="true" />
              Selesai
            </span>
          </div>
        </div>

        {/* Progres Status Penanganan & Komunikasi Wali Murid */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Status Penanganan & Rujukan Medis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Proporsi penyelesaian kasus dari daftar prioritas UKS
            </p>

            <div className="space-y-3.5">
              {statusSummary.map((item) => {
                const Icon = item.icon;
                const pct =
                  priorityStudents.length > 0
                    ? Math.round((item.count / priorityStudents.length) * 100)
                    : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={`inline-flex items-center gap-1.5 font-medium ${item.textClass}`}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {item.label}
                      </span>
                      <span className="font-mono tabular-nums text-slate-900 font-semibold">
                        {item.count} siswa <span className="text-slate-500 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full ${item.barClass} transition-all duration-300`}
                        style={{width: `${pct}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">Komunikasi Wali Murid</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {parentContactedCount} / {priorityStudents.length} Sudah Dihubungi (
              {priorityStudents.length > 0
                ? Math.round((parentContactedCount / priorityStudents.length) * 100)
                : 0}
              %)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
