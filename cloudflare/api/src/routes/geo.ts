import {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnv, Ctx} from '../app';
import {AppError, success} from '../lib/errors';
import {num, parseQuery} from '../lib/validate';

const CACHE_TTL_SECONDS = 24 * 3600;

type Place = {name?: string; display_name?: string; address?: Record<string, string>; lat?: string; lon?: string; error?: string};

function shortName(item: Place): string {
  const address = item.address ?? {};
  const parts = [
    item.name,
    address.road,
    address.suburb || address.quarter || address.neighbourhood,
    address.city_district || address.district,
    address.city || address.province || address.state,
  ];
  const seen: string[] = [];
  for (const part of parts) if (part && !seen.includes(part)) seen.push(part);
  return seen.slice(0, 3).join(' ') || item.display_name || '';
}

/** Python's round(x, n) for cache keys. */
const roundTo = (x: number, n: number) => Number(x.toFixed(n));

async function cached(c: Ctx, key: string, load: () => Promise<unknown>) {
  const cacheKey = new Request(`https://geo-cache.pethaii.internal/${encodeURIComponent(key)}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) return c.json(success(await hit.json()));
  const value = await load();
  c.executionCtx.waitUntil(
    caches.default.put(
      cacheKey,
      new Response(JSON.stringify(value), {
        headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`},
      }),
    ),
  );
  return c.json(success(value));
}

async function nominatim(c: Ctx, path: string, params: Record<string, string>) {
  const geo = c.env.GEO.get(c.env.GEO.idFromName('nominatim'));
  const result = await geo.nominatim(path, params);
  if (!result.ok || !('data' in result)) throw new AppError(502, 'GEOCODE_UNAVAILABLE', 'Place search is unavailable');
  return result.data;
}

const SearchQuery = z.object({
  q: z.string().min(2).max(120),
  lat: num().pipe(z.number().min(-90).max(90)).optional(),
  lng: num().pipe(z.number().min(-180).max(180)).optional(),
});
const ReverseQuery = z.object({
  lat: num().pipe(z.number().min(-90).max(90)),
  lng: num().pipe(z.number().min(-180).max(180)),
});

export const geo = new Hono<AppEnv>().basePath('/geo');

geo.get('/search', async c => {
  const q = parseQuery(c, SearchQuery);
  const query = q.q.split(/\s+/).filter(Boolean).join(' ');
  const hasNear = q.lat != null && q.lng != null;
  const near = hasNear ? `${roundTo(q.lat!, 1)},${roundTo(q.lng!, 1)}` : '';
  return cached(c, `s|${query.toLowerCase()}|${near}`, async () => {
    const params: Record<string, string> = {q: query, countrycodes: 'th', limit: '6', addressdetails: '1'};
    if (hasNear) {
      // Prefer (but do not restrict to) results around the user.
      params.viewbox = `${q.lng! - 0.3},${q.lat! + 0.3},${q.lng! + 0.3},${q.lat! - 0.3}`;
    }
    const rows = (await nominatim(c, '/search', params)) as Place[];
    return rows
      .filter(r => r.lat && r.lon)
      .map(r => ({name: shortName(r), address: r.display_name ?? '', latitude: Number(r.lat), longitude: Number(r.lon)}));
  });
});

geo.get('/reverse', async c => {
  const q = parseQuery(c, ReverseQuery);
  return cached(c, `r|${roundTo(q.lat, 4)},${roundTo(q.lng, 4)}`, async () => {
    const row = (await nominatim(c, '/reverse', {lat: String(q.lat), lon: String(q.lng), zoom: '17', addressdetails: '1'})) as Place;
    return {name: row && typeof row === 'object' && !row.error ? shortName(row) : ''};
  });
});
