export interface KpiMetric {
  id: string;
  label: string;
  valueText: string;
  numericValue: number;
  isPercentage: boolean;
  caption: string;
}

export interface NutritionRow {
  category: string;
  imtRange: string;
  count: number;
  percentText: string;
  percentValue: number;
  evaluation: string;
  isTotal: boolean;
}

export interface HealthIndicatorRow {
  indicator: string;
  normalCount: number;
  followUpCount: number;
  problemPercentText: string;
  problemPercentValue: number;
  priority: string;
  mainAction: string;
}

export interface PriorityStudent {
  no: number;
  nis: string;
  name: string;
  className: string;
  gender: string;
  nutritionStatus: string;
  medicalFinding: string;
  uksRecommendation: string;
  referralFacility: string;
  handlingStatus: string;
  parentContacted: string;
  targetNotes: string;
}

export interface ParsedHealthDashboard {
  title: string;
  subtitle: string;
  kpis: KpiMetric[];
  nutritionDistribution: NutritionRow[];
  healthIndicators: HealthIndicatorRow[];
  priorityStudents: PriorityStudent[];
  rawRowCount: number;
}

export type AuditRuleStatus = 'pass' | 'warning' | 'fail';

export interface AccuracyCheckItem {
  id: string;
  title: string;
  detail: string;
  expected: string;
  actual: string;
  status: AuditRuleStatus;
}

export interface AccuracyAuditReport {
  overallStatus: AuditRuleStatus;
  passedCount: number;
  totalChecks: number;
  accuracyScorePercent: number;
  checks: AccuracyCheckItem[];
}

export interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  sourceLabel: string;
  latencyMs: number;
  sha256Short: string;
  changeDetected: boolean;
  accuracyStatus: AuditRuleStatus;
  passedChecks: number;
  totalChecks: number;
  message: string;
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

export function parseIndoNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/%/g, '').replace(/\s+/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseHealthSpreadsheet(csvText: string): ParsedHealthDashboard {
  const rows = parseCsvRows(csvText);

  let title = 'DASHBOARD & RINGKASAN MONITORING KESEHATAN SISWA';
  let subtitle = 'SDIT H. Maksudi Temi • Rekapitulasi Pelayanan Kesehatan & Tindak Lanjut Medis UKS';

  for (let r = 0; r < Math.min(rows.length, 6); r += 1) {
    const nonEmpty = rows[r].filter(Boolean);
    if (nonEmpty.length === 1 && nonEmpty[0].toUpperCase().includes('DASHBOARD')) {
      title = nonEmpty[0];
    } else if (nonEmpty.length === 1 && nonEmpty[0].toUpperCase().includes('SDIT')) {
      subtitle = nonEmpty[0];
    }
  }

  // 1. Parse KPI strip dynamically
  const kpis: KpiMetric[] = [];
  const kpiHeaderRowIndex = rows.findIndex((row) =>
    row.some((cell) => cell.toUpperCase().includes('TOTAL SISWA DIPERIKSA')),
  );

  if (kpiHeaderRowIndex !== -1 && rows[kpiHeaderRowIndex + 1]) {
    const headerRow = rows[kpiHeaderRowIndex];
    const valueRow = rows[kpiHeaderRowIndex + 1] || [];
    const captionRow = rows[kpiHeaderRowIndex + 2] || [];

    headerRow.forEach((cell, colIndex) => {
      if (!cell) return;
      const valueText = valueRow[colIndex] || '0';
      const caption = captionRow[colIndex] || '';
      kpis.push({
        id: `kpi-${colIndex}`,
        label: cell,
        valueText,
        numericValue: parseIndoNumber(valueText),
        isPercentage: valueText.includes('%'),
        caption,
      });
    });
  }

  // 2. Parse Nutrition Distribution & Health Indicators side-by-side table
  const nutritionDistribution: NutritionRow[] = [];
  const healthIndicators: HealthIndicatorRow[] = [];

  const sectionHeaderRowIndex = rows.findIndex((row) =>
    row.some((cell) => cell.toLowerCase().includes('kategori status gizi')),
  );

  if (sectionHeaderRowIndex !== -1) {
    const headerRow = rows[sectionHeaderRowIndex];
    const catCol = headerRow.findIndex((c) => c.toLowerCase().includes('kategori status gizi'));
    const imtCol = headerRow.findIndex((c) => c.toLowerCase().includes('rentang imt'));
    const countCol = headerRow.findIndex((c) => c.toLowerCase() === 'jumlah');
    const pctCol = headerRow.findIndex((c) => c.toLowerCase() === 'persen');
    const evalCol = headerRow.findIndex((c) => c.toLowerCase().includes('status / evaluasi'));

    const indCol = headerRow.findIndex((c) => c.toLowerCase().includes('indikator pemeriksaan'));
    const normCol = headerRow.findIndex((c) => c.toLowerCase().includes('kondisi normal'));
    const followCol = headerRow.findIndex((c) => c.toLowerCase().includes('perlu tindak lanjut'));
    const probPctCol = headerRow.findIndex((c) => c.toLowerCase().includes('% masalah'));
    const prioCol = headerRow.findIndex((c) => c.toLowerCase() === 'prioritas');
    const actionCol = headerRow.findIndex((c) => c.toLowerCase().includes('tindak lanjut utama'));

    for (let r = sectionHeaderRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r];
      if (!row || row.every((c) => !c)) break;
      if (row.some((c) => c.toUpperCase().includes('DAFTAR PRIORITAS'))) break;

      if (catCol !== -1 && row[catCol]) {
        const category = row[catCol];
        const percentText = pctCol !== -1 ? row[pctCol] || '0%' : '0%';
        nutritionDistribution.push({
          category,
          imtRange: imtCol !== -1 ? row[imtCol] || '-' : '-',
          count: countCol !== -1 ? parseIndoNumber(row[countCol]) : 0,
          percentText,
          percentValue: parseIndoNumber(percentText),
          evaluation: evalCol !== -1 ? row[evalCol] || '-' : '-',
          isTotal: category.toLowerCase().includes('total'),
        });
      }

      if (indCol !== -1 && row[indCol]) {
        const indicator = row[indCol];
        const problemPercentText = probPctCol !== -1 ? row[probPctCol] || '0%' : '0%';
        healthIndicators.push({
          indicator,
          normalCount: normCol !== -1 ? parseIndoNumber(row[normCol]) : 0,
          followUpCount: followCol !== -1 ? parseIndoNumber(row[followCol]) : 0,
          problemPercentText,
          problemPercentValue: parseIndoNumber(problemPercentText),
          priority: prioCol !== -1 ? row[prioCol] || 'Sedang' : 'Sedang',
          mainAction: actionCol !== -1 ? row[actionCol] || '-' : '-',
        });
      }
    }
  }

  // 3. Parse Priority Students Table
  const priorityStudents: PriorityStudent[] = [];
  const studentHeaderRowIndex = rows.findIndex(
    (row) =>
      row.some((c) => c.toUpperCase() === 'NIS') &&
      row.some((c) => c.toLowerCase().includes('nama siswa')),
  );

  if (studentHeaderRowIndex !== -1) {
    const headerRow = rows[studentHeaderRowIndex];
    const colIdx = {
      no: headerRow.findIndex((c) => c.toLowerCase() === 'no'),
      nis: headerRow.findIndex((c) => c.toUpperCase() === 'NIS'),
      name: headerRow.findIndex((c) => c.toLowerCase().includes('nama siswa')),
      className: headerRow.findIndex((c) => c.toLowerCase() === 'kelas'),
      gender: headerRow.findIndex((c) => c.toLowerCase().includes('jenis kelamin')),
      nutritionStatus: headerRow.findIndex((c) => c.toLowerCase().includes('status gizi')),
      medicalFinding: headerRow.findIndex((c) => c.toLowerCase().includes('hasil temuan')),
      uksRecommendation: headerRow.findIndex((c) => c.toLowerCase().includes('rekomendasi')),
      referralFacility: headerRow.findIndex((c) => c.toLowerCase().includes('fasilitas rujukan')),
      handlingStatus: headerRow.findIndex((c) => c.toLowerCase().includes('status penanganan')),
      parentContacted: headerRow.findIndex((c) => c.toLowerCase().includes('wali murid')),
      targetNotes: headerRow.findIndex((c) => c.toLowerCase().includes('keterangan')),
    };

    for (let r = studentHeaderRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r];
      if (!row || row.every((c) => !c)) continue;
      const nis = colIdx.nis !== -1 ? row[colIdx.nis] || '' : '';
      const name = colIdx.name !== -1 ? row[colIdx.name] || '' : '';
      if (!nis && !name) continue;

      priorityStudents.push({
        no: colIdx.no !== -1 ? parseIndoNumber(row[colIdx.no]) || priorityStudents.length + 1 : priorityStudents.length + 1,
        nis,
        name,
        className: colIdx.className !== -1 ? row[colIdx.className] || '-' : '-',
        gender: colIdx.gender !== -1 ? row[colIdx.gender] || '-' : '-',
        nutritionStatus: colIdx.nutritionStatus !== -1 ? row[colIdx.nutritionStatus] || '-' : '-',
        medicalFinding: colIdx.medicalFinding !== -1 ? row[colIdx.medicalFinding] || '-' : '-',
        uksRecommendation: colIdx.uksRecommendation !== -1 ? row[colIdx.uksRecommendation] || '-' : '-',
        referralFacility: colIdx.referralFacility !== -1 ? row[colIdx.referralFacility] || '-' : '-',
        handlingStatus: colIdx.handlingStatus !== -1 ? row[colIdx.handlingStatus] || '-' : '-',
        parentContacted: colIdx.parentContacted !== -1 ? row[colIdx.parentContacted] || '-' : '-',
        targetNotes: colIdx.targetNotes !== -1 ? row[colIdx.targetNotes] || '-' : '-',
      });
    }
  }

  return {
    title,
    subtitle,
    kpis,
    nutritionDistribution,
    healthIndicators,
    priorityStudents,
    rawRowCount: rows.length,
  };
}

export function auditHealthData(data: ParsedHealthDashboard): AccuracyAuditReport {
  const checks: AccuracyCheckItem[] = [];

  const totalKpi = data.kpis.find((k) => k.label.toUpperCase().includes('TOTAL SISWA'));
  const goodNutritionKpi = data.kpis.find((k) => k.label.toUpperCase().includes('STATUS GIZI BAIK'));
  const attentionNutritionKpi = data.kpis.find((k) => k.label.toUpperCase().includes('PERLU ATENSI GIZI'));
  const uksVisitsKpi = data.kpis.find((k) => k.label.toUpperCase().includes('KUNJUNGAN UKS'));

  const totalStudents = totalKpi?.numericValue ?? 0;
  const nutritionCategories = data.nutritionDistribution.filter((row) => !row.isTotal);
  const nutritionTotalRow = data.nutritionDistribution.find((row) => row.isTotal);
  const sumNutritionCategories = nutritionCategories.reduce((acc, row) => acc + row.count, 0);

  // Check 1: Total Siswa vs Distribusi Gizi
  const check1Pass =
    totalStudents > 0 &&
    sumNutritionCategories === totalStudents &&
    (!nutritionTotalRow || nutritionTotalRow.count === totalStudents);
  checks.push({
    id: 'total-vs-nutrition',
    title: 'Konsistensi Total Siswa & Distribusi Gizi',
    detail: 'Memastikan jumlah seluruh kategori IMT/U sama dengan KPI Total Siswa Diperiksa.',
    expected: `${totalStudents} siswa`,
    actual: `${sumNutritionCategories} siswa (Total tabel: ${nutritionTotalRow?.count ?? sumNutritionCategories})`,
    status: totalStudents === 0 ? 'fail' : check1Pass ? 'pass' : 'fail',
  });

  // Check 2: Gizi Baik + Perlu Atensi Gizi == Total Siswa
  const goodCount = goodNutritionKpi?.numericValue ?? 0;
  const attentionCount = attentionNutritionKpi?.numericValue ?? 0;
  const check2Pass = totalStudents > 0 && goodCount + attentionCount === totalStudents;
  checks.push({
    id: 'good-plus-attention',
    title: 'Keseimbangan KPI Gizi Baik & Atensi Gizi',
    detail: 'Memverifikasi penjumlahan Status Gizi Baik dan Perlu Atensi Gizi terhadap total kohort.',
    expected: `${totalStudents} siswa`,
    actual: `${goodCount} + ${attentionCount} = ${goodCount + attentionCount} siswa`,
    status: totalStudents === 0 ? 'fail' : check2Pass ? 'pass' : 'fail',
  });

  // Check 3: Akurasi Persentase IMT/U
  const pctMismatches = nutritionCategories.filter((row) => {
    if (totalStudents === 0) return true;
    const expectedPct = (row.count / totalStudents) * 100;
    return Math.abs(expectedPct - row.percentValue) > 0.15;
  });
  const totalPctSum = nutritionCategories.reduce((acc, row) => acc + row.percentValue, 0);
  const check3Pass =
    nutritionCategories.length > 0 &&
    pctMismatches.length === 0 &&
    Math.abs(totalPctSum - 100) <= 0.2;
  checks.push({
    id: 'nutrition-percent',
    title: 'Validitas Persentase Distribusi IMT/U',
    detail: 'Menghitung ulang persentase tiap kategori status gizi dan total 100,0%.',
    expected: '100,0% (seluruh baris akurat ±0,1%)',
    actual: `${totalPctSum.toFixed(1).replace('.', ',')}% (${pctMismatches.length} selisih baris)`,
    status: nutritionCategories.length === 0 ? 'fail' : check3Pass ? 'pass' : 'warning',
  });

  // Check 4: Indikator Kesehatan Khusus & UKS
  const uksVisits = uksVisitsKpi?.numericValue ?? 0;
  const indicatorIssues: string[] = [];
  data.healthIndicators.forEach((ind) => {
    const rowTotal = ind.normalCount + ind.followUpCount;
    const isRegister = ind.indicator.toLowerCase().includes('register');
    const expectedCohort = isRegister && uksVisits > 0 ? uksVisits : totalStudents;
    const expectedPct = rowTotal > 0 ? (ind.followUpCount / rowTotal) * 100 : 0;

    if (expectedCohort > 0 && rowTotal !== expectedCohort) {
      indicatorIssues.push(`${ind.indicator} (${rowTotal} ≠ ${expectedCohort})`);
    } else if (Math.abs(expectedPct - ind.problemPercentValue) > 0.15) {
      indicatorIssues.push(`${ind.indicator} (% masalah tidak cocok)`);
    }
  });
  checks.push({
    id: 'health-indicators',
    title: 'Akurasi Indikator Kesehatan Khusus & UKS',
    detail: 'Memeriksa keseimbangan Kondisi Normal + Tindak Lanjut serta kalkulasi % Masalah.',
    expected: `${data.healthIndicators.length}/${data.healthIndicators.length} indikator konsisten`,
    actual:
      indicatorIssues.length === 0
        ? `${data.healthIndicators.length}/${data.healthIndicators.length} indikator valid`
        : `${indicatorIssues.length} ketidaksesuaian: ${indicatorIssues[0]}`,
    status: data.healthIndicators.length === 0 ? 'fail' : indicatorIssues.length === 0 ? 'pass' : 'warning',
  });

  // Check 5: Integritas Daftar Prioritas Tindak Lanjut Siswa
  const nisSet = new Set<string>();
  let invalidRows = 0;
  data.priorityStudents.forEach((student) => {
    const hasMissing =
      !student.nis ||
      !student.name ||
      !student.className ||
      !student.medicalFinding ||
      !student.handlingStatus;
    const isDuplicateNis = nisSet.has(student.nis);
    nisSet.add(student.nis);
    if (hasMissing || isDuplicateNis) {
      invalidRows += 1;
    }
  });
  checks.push({
    id: 'student-integrity',
    title: 'Integritas Rekam Medis & NIS Siswa Prioritas',
    detail: 'Memastikan seluruh baris siswa memiliki NIS unik, nama, kelas, temuan medis, dan status.',
    expected: `${data.priorityStudents.length} baris lengkap & NIS unik`,
    actual:
      invalidRows === 0
        ? `${data.priorityStudents.length} siswa terverifikasi lengkap`
        : `${invalidRows} baris tidak lengkap / duplikat NIS`,
    status: data.priorityStudents.length === 0 ? 'warning' : invalidRows === 0 ? 'pass' : 'fail',
  });

  const passedCount = checks.filter((c) => c.status === 'pass').length;
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarning = checks.some((c) => c.status === 'warning');
  const overallStatus: AuditRuleStatus = hasFail ? 'fail' : hasWarning ? 'warning' : 'pass';
  const accuracyScorePercent = Math.round((passedCount / checks.length) * 100);

  return {
    overallStatus,
    passedCount,
    totalChecks: checks.length,
    accuracyScorePercent,
    checks,
  };
}
