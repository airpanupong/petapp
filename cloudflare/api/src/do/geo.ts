import {DurableObject} from 'cloudflare:workers';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Nominatim's usage policy requires an identifying User-Agent and at most one request per second.
const HEADERS = {'User-Agent': 'PetHaii/1.0 (support@pethaii.com)', 'Accept-Language': 'th,en'};
const MIN_INTERVAL_MS = 1000;

export type GeoResult = {ok: true; data: unknown} | {ok: false; status: number | null};

/** A single global instance that serializes Nominatim calls across every Worker isolate. */
export class GeoDO extends DurableObject<Env> {
  private lastCall = 0;
  private queue: Promise<unknown> = Promise.resolve();

  async nominatim(path: string, params: Record<string, string>): Promise<GeoResult> {
    const run = async (): Promise<GeoResult> => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCall);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      try {
        const url = `${NOMINATIM}${path}?${new URLSearchParams({...params, format: 'jsonv2'})}`;
        const res = await fetch(url, {headers: HEADERS, signal: AbortSignal.timeout(8000)});
        if (res.status !== 200) {
          await res.body?.cancel();
          console.warn(JSON.stringify({msg: 'nominatim status', status: res.status}));
          return {ok: false, status: res.status};
        }
        return {ok: true, data: await res.json()};
      } catch (err) {
        console.warn(JSON.stringify({msg: 'nominatim request failed', error: String(err)}));
        return {ok: false, status: null};
      } finally {
        this.lastCall = Date.now();
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
