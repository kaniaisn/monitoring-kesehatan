import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

export const DEFAULT_SHEET_RELATIVE_PATH =
  'assets/aistudio/Data_Monitoring_Kesehatan_Siswa_-_SDIT_H_da087a2c._Maksudi_Temi';

export const DEFAULT_SHEET_DISK_PATH = path.resolve(
  process.cwd(),
  'public',
  DEFAULT_SHEET_RELATIVE_PATH,
);

export interface SheetProxyResult {
  status: number;
  body: {
    ok: boolean;
    sourceType?: 'local' | 'google_sheets' | 'csv_url';
    sourceLabel?: string;
    resolvedUrl?: string | null;
    fetchedAt: string;
    latencyMs: number;
    sha256?: string;
    csvText?: string;
    error?: string;
  };
}

function isDisallowedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    if (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    ) {
      return true;
    }
  }

  if (net.isIPv6(lower)) {
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

export function normalizeGoogleSheetUrl(rawInput: string): {
  resolvedUrl: string;
  sourceType: 'google_sheets' | 'csv_url';
} {
  const trimmed = rawInput.trim();
  const parsed = new URL(trimmed);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL harus menggunakan protokol https:// atau http://');
  }

  if (isDisallowedHostname(parsed.hostname)) {
    throw new Error('Alamat host lokal atau jaringan privat tidak diizinkan.');
  }

  // Handle published Google Sheets URL: /spreadsheets/d/e/{PUB_ID}/pubhtml
  const pubMatch = parsed.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (parsed.hostname.includes('docs.google.com') && pubMatch) {
    const pubId = pubMatch[1];
    const gid = parsed.searchParams.get('gid');
    const outUrl = new URL(`https://docs.google.com/spreadsheets/d/e/${pubId}/pub`);
    outUrl.searchParams.set('output', 'csv');
    if (gid) {
      outUrl.searchParams.set('gid', gid);
      outUrl.searchParams.set('single', 'true');
    }
    return {resolvedUrl: outUrl.toString(), sourceType: 'google_sheets'};
  }

  // Handle standard Google Sheets URL: /spreadsheets/d/{SHEET_ID}/edit#gid=0
  const docMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (parsed.hostname.includes('docs.google.com') && docMatch) {
    const sheetId = docMatch[1];
    const hashGidMatch = parsed.hash.match(/gid=(\d+)/);
    const gid = parsed.searchParams.get('gid') || (hashGidMatch ? hashGidMatch[1] : null);
    const outUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
    outUrl.searchParams.set('format', 'csv');
    if (gid) {
      outUrl.searchParams.set('gid', gid);
    }
    return {resolvedUrl: outUrl.toString(), sourceType: 'google_sheets'};
  }

  return {resolvedUrl: parsed.toString(), sourceType: 'csv_url'};
}

async function readDefaultSheetCsv(originHint?: string): Promise<string> {
  try {
    return await fs.readFile(DEFAULT_SHEET_DISK_PATH, 'utf-8');
  } catch (fsError) {
    if (originHint) {
      const staticAssetUrl = `${originHint.replace(/\/$/, '')}/${DEFAULT_SHEET_RELATIVE_PATH}`;
      const res = await fetch(staticAssetUrl, {cache: 'no-store'});
      if (res.ok) {
        return await res.text();
      }
    }
    throw fsError;
  }
}

export async function fetchSheetDataPayload(
  rawUrl: string,
  originHint?: string,
): Promise<SheetProxyResult> {
  const startedAt = Date.now();
  const trimmedUrl = rawUrl.trim();

  try {
    if (!trimmedUrl || trimmedUrl === 'default') {
      const csvText = await readDefaultSheetCsv(originHint);
      const sha256 = crypto.createHash('sha256').update(csvText).digest('hex');
      return {
        status: 200,
        body: {
          ok: true,
          sourceType: 'local',
          sourceLabel: 'Data_Monitoring_Kesehatan_Siswa_-_SDIT_H._Maksudi_Temi.csv',
          resolvedUrl: null,
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          sha256,
          csvText,
        },
      };
    }

    const {resolvedUrl, sourceType} = normalizeGoogleSheetUrl(trimmedUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const fetchUrl = new URL(resolvedUrl);
      fetchUrl.searchParams.set('_t', String(Date.now()));

      const upstream = await fetch(fetchUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8',
          'User-Agent': 'SDIT-UKS-Health-Monitor/1.0',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!upstream.ok) {
        return {
          status: 400,
          body: {
            ok: false,
            error: `Gagal mengambil data Google Spreadsheet (HTTP ${upstream.status}). Pastikan akses link disetel ke "Siapa saja yang memiliki link dapat melihat".`,
            fetchedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
          },
        };
      }

      const contentType = upstream.headers.get('content-type') || '';
      const csvText = await upstream.text();

      if (
        contentType.includes('text/html') ||
        csvText.trimStart().toLowerCase().startsWith('<!doctype html') ||
        csvText.trimStart().toLowerCase().startsWith('<html')
      ) {
        return {
          status: 400,
          body: {
            ok: false,
            error:
              'Link mengembalikan halaman HTML, bukan CSV. Pastikan Google Spreadsheet berstatus publik ("Siapa saja yang memiliki link dapat melihat") atau dipublikasikan sebagai CSV.',
            fetchedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
          },
        };
      }

      const sha256 = crypto.createHash('sha256').update(csvText).digest('hex');
      return {
        status: 200,
        body: {
          ok: true,
          sourceType,
          sourceLabel:
            sourceType === 'google_sheets' ? 'Google Spreadsheet (Live)' : 'CSV URL Eksternal',
          resolvedUrl,
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          sha256,
          csvText,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan saat membaca sumber spreadsheet.';
    return {
      status: 400,
      body: {
        ok: false,
        error: message,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}
