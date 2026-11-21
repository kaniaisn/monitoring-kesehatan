import {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import type {PriorityStudent} from '../lib/healthSheet';

interface StudentPriorityTableProps {
  students: PriorityStudent[];
  nutritionFilter: string;
  onNutritionFilterChange: (value: string) => void;
}

type SortKey = 'no' | 'name' | 'className' | 'handlingStatus';

function getHandlingStatusMeta(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes('rujukan')) {
    return {textClass: 'text-red-700', icon: AlertTriangle};
  }
  if (lower.includes('tindak lanjut')) {
    return {textClass: 'text-amber-700', icon: Stethoscope};
  }
  if (lower.includes('proses')) {
    return {textClass: 'text-teal-700', icon: Clock};
  }
  return {textClass: 'text-emerald-700', icon: CheckCircle2};
}

function getNutritionTextClass(nutrition: string) {
  const lower = nutrition.toLowerCase();
  if (lower.includes('obesitas')) return 'text-red-700 font-medium';
  if (lower.includes('kurang')) return 'text-orange-700 font-medium';
  if (lower.includes('lebih')) return 'text-amber-700 font-medium';
  return 'text-emerald-700 font-medium';
}

export function StudentPriorityTable({
  students,
  nutritionFilter,
  onNutritionFilterChange,
}: StudentPriorityTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [classFilter, setClassFilter] = useState<string>('Semua');
  const [sortKey, setSortKey] = useState<SortKey>('no');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<PriorityStudent | null>(null);

  const uniqueClasses = useMemo(() => {
    const set = new Set(students.map((s) => s.className).filter(Boolean));
    return ['Semua', ...Array.from(set).sort()];
  }, [students]);

  const uniqueNutrition = useMemo(() => {
    const set = new Set(students.map((s) => s.nutritionStatus).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [students]);

  const statusTabs = useMemo(() => {
    const counts = {
      Semua: students.length,
      'Perlu Rujukan': students.filter((s) => s.handlingStatus === 'Perlu Rujukan').length,
      'Perlu Tindak Lanjut': students.filter(
        (s) => s.handlingStatus === 'Perlu Tindak Lanjut',
      ).length,
      'Dalam Proses': students.filter((s) => s.handlingStatus === 'Dalam Proses').length,
      Selesai: students.filter((s) => s.handlingStatus === 'Selesai').length,
    };
    return Object.entries(counts);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = students.filter((s) => {
      const matchesStatus =
        statusFilter === 'Semua' || s.handlingStatus === statusFilter;
      const matchesClass = classFilter === 'Semua' || s.className === classFilter;
      const matchesNutrition =
        nutritionFilter === 'Semua' ||
        s.nutritionStatus.toLowerCase() === nutritionFilter.toLowerCase() ||
        (nutritionFilter.toLowerCase().includes('baik') &&
          s.nutritionStatus.toLowerCase().includes('baik'));

      const matchesQuery =
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.nis.toLowerCase().includes(query) ||
        s.medicalFinding.toLowerCase().includes(query) ||
        s.referralFacility.toLowerCase().includes(query) ||
        s.uksRecommendation.toLowerCase().includes(query);

      return matchesStatus && matchesClass && matchesNutrition && matchesQuery;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'no') cmp = a.no - b.no;
      else cmp = a[sortKey].localeCompare(b[sortKey], 'id');
      return sortAsc ? cmp : -cmp;
    });
  }, [students, searchQuery, statusFilter, classFilter, nutritionFilter, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function handleExportCsv() {
    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Jenis Kelamin',
      'Status Gizi',
      'Hasil Temuan Medis',
      'Rekomendasi / Tindak Lanjut UKS',
      'Fasilitas Rujukan',
      'Status Penanganan',
      'Wali Murid Dihubungi',
      'Keterangan / Target Selesai',
    ];
    const escape = (val: string | number) => {
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const lines = [
      headers.join(','),
      ...filteredStudents.map((s) =>
        [
          s.no,
          s.nis,
          s.name,
          s.className,
          s.gender,
          s.nutritionStatus,
          s.medicalFinding,
          s.uksRecommendation,
          s.referralFacility,
          s.handlingStatus,
          s.parentContacted,
          s.targetNotes,
        ]
          .map(escape)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tindak-lanjut-uks-sdit-h-maksudi-temi.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="tindak-lanjut" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Daftar Prioritas Tindak Lanjut Medis & Rujukan Siswa
          </h2>
          <p className="text-sm text-slate-600">
            Siswa yang memerlukan penanganan khusus dokter, puskesmas, atau pendampingan intensif UKS.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Unduh CSV ({filteredStudents.length})
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Status Tabs */}
          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md"
            role="tablist"
            aria-label="Filter status penanganan"
          >
            {statusTabs.map(([label, count]) => {
              const active = statusFilter === label;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(label)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label} <span className="font-mono tabular-nums text-slate-400 ml-1">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, atau temuan..."
                aria-label="Cari siswa prioritas"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Filter kelas"
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls === 'Semua' ? 'Semua Kelas' : `Kelas ${cls}`}
                </option>
              ))}
            </select>

            <select
              value={nutritionFilter}
              onChange={(e) => onNutritionFilterChange(e.target.value)}
              aria-label="Filter status gizi"
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              {uniqueNutrition.map((nut) => (
                <option key={nut} value={nut}>
                  {nut === 'Semua' ? 'Semua Status Gizi' : nut}
                </option>
              ))}
            </select>

            {(searchQuery ||
              statusFilter !== 'Semua' ||
              classFilter !== 'Semua' ||
              nutritionFilter !== 'Semua') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('Semua');
                  setClassFilter('Semua');
                  onNutritionFilterChange('Semua');
                }}
                className="px-2.5 py-2 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* High-Density Data Grid */}
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              Tidak ada data siswa yang sesuai dengan filter saat ini.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ubah kata kunci pencarian atau reset filter untuk menampilkan seluruh data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-200 -mx-4 px-4">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-3 w-12">
                    <button
                      type="button"
                      onClick={() => handleSort('no')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      No <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 w-28">NIS</th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Nama Siswa <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 w-20">
                    <button
                      type="button"
                      onClick={() => handleSort('className')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Kelas <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 w-28">Status Gizi</th>
                  <th className="py-2.5 px-3">Hasil Temuan Medis</th>
                  <th className="py-2.5 px-3">Tindak Lanjut & Rujukan</th>
                  <th className="py-2.5 pl-3 w-40">
                    <button
                      type="button"
                      onClick={() => handleSort('handlingStatus')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const statusMeta = getHandlingStatusMeta(student.handlingStatus);
                  const StatusIcon = statusMeta.icon;
                  return (
                    <tr
                      key={student.nis || student.no}
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-3 font-mono tabular-nums text-xs text-slate-500">
                        {student.no}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600">
                        {student.nis}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{student.name}</div>
                        <div className="text-xs text-slate-500">
                          {student.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · Wali:{' '}
                          {student.parentContacted}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-700">
                        {student.className}
                      </td>
                      <td className={`py-3 px-3 text-xs ${getNutritionTextClass(student.nutritionStatus)}`}>
                        {student.nutritionStatus}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700 max-w-xs">
                        <p className="line-clamp-2">{student.medicalFinding}</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700 max-w-xs">
                        <div className="font-medium text-slate-900">
                          {student.uksRecommendation}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {student.referralFacility}
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${statusMeta.textClass}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                          {student.handlingStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Student Detail Modal */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-detail-title"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full border-l border-slate-200 p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    NIS {selectedStudent.nis} · Kelas {selectedStudent.className}
                  </div>
                  <h3
                    id="student-detail-title"
                    className="text-lg font-semibold text-slate-900 mt-1"
                  >
                    {selectedStudent.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="Tutup detail siswa"
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <dl className="mt-5 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <dt className="text-xs text-slate-500">Jenis Kelamin</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {selectedStudent.gender === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Status Gizi (IMT/U)</dt>
                    <dd className={`mt-0.5 ${getNutritionTextClass(selectedStudent.nutritionStatus)}`}>
                      {selectedStudent.nutritionStatus}
                    </dd>
                  </div>
                </div>

                <div className="pb-4 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Hasil Temuan Medis</dt>
                  <dd className="text-slate-900 mt-1 leading-relaxed">
                    {selectedStudent.medicalFinding}
                  </dd>
                </div>

                <div className="pb-4 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Rekomendasi / Tindak Lanjut UKS</dt>
                  <dd className="font-medium text-slate-900 mt-1">
                    {selectedStudent.uksRecommendation}
                  </dd>
                </div>

                <div className="pb-4 border-b border-slate-100">
                  <dt className="text-xs text-slate-500">Fasilitas Rujukan</dt>
                  <dd className="text-slate-900 mt-1">{selectedStudent.referralFacility}</dd>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <dt className="text-xs text-slate-500">Status Penanganan</dt>
                    <dd className="font-medium text-slate-900 mt-1">
                      {selectedStudent.handlingStatus}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Wali Murid Dihubungi</dt>
                    <dd className="font-medium text-emerald-700 mt-1">
                      {selectedStudent.parentContacted}
                    </dd>
                  </div>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">Keterangan / Target Selesai</dt>
                  <dd className="text-slate-800 mt-1">{selectedStudent.targetNotes}</dd>
                </div>
              </dl>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="w-full py-2.5 px-4 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
