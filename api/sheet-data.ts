import type {IncomingMessage, ServerResponse} from 'node:http';
import {fetchSheetDataPayload} from '../src/lib/sheetProxy.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const reqUrl = new URL(req.url || '/api/sheet-data', 'http://localhost');
  const rawUrl = reqUrl.searchParams.get('url') || '';

  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const originHint = host ? `${proto}://${host}` : undefined;

  const result = await fetchSheetDataPayload(rawUrl, originHint);

  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(result.body));
}
