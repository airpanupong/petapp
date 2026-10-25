import type {Db} from '../lib/db';
import {uuid} from '../lib/db';
import {b64encode} from '../lib/encoding';
import {AppError} from '../lib/errors';
import {now} from '../lib/time';

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const PREVIEW_SIDE = 512;
const TIMEOUT_MS = 20_000;

const PROMPT = `You moderate photos uploaded to a lost-and-found pet website.
Answer with JSON only:
- "sexual": true if the image shows nudity, exposed genitals or breasts, sexual activity, or sexually suggestive content involving people (including drawings).
- "gore": true if the image shows graphic blood, open wounds, mutilation, or a dead body (human or animal).
- "animal": true if at least one real animal (dog, cat, bird, rabbit, any animal) is clearly visible.`;

const SCHEMA = {
  type: 'object',
  properties: {sexual: {type: 'boolean'}, gore: {type: 'boolean'}, animal: {type: 'boolean'}},
  required: ['sexual', 'gore', 'animal'],
};

type Labels = {sexual: boolean; gore: boolean; animal: boolean};
export type Verdict = {verdict: 'allowed' | 'flagged' | 'rejected'; reason: string | null; output: string};

/**
 * Guests are held to a strict policy (must show an animal, fail closed); signed-in users only lose
 * sexual images, because they also upload avatars and chat photos. Gore is never rejected outright:
 * injured animals are a real part of found reports, so an admin reviews those instead.
 */
export function decide(labels: Labels | null, guest: boolean, output: string): Verdict {
  if (!labels) return guest ? {verdict: 'rejected', reason: 'ai_error', output} : {verdict: 'flagged', reason: 'ai_error', output};
  if (labels.sexual) return {verdict: 'rejected', reason: 'sexual', output};
  if (guest && !labels.animal) return {verdict: 'rejected', reason: 'no_animal', output};
  if (labels.gore) return {verdict: 'flagged', reason: 'gore', output};
  return {verdict: 'allowed', reason: null, output};
}

async function preview(env: Env, data: ArrayBuffer): Promise<string> {
  try {
    const result = await env.IMAGES.input(new Response(data).body!)
      .transform({width: PREVIEW_SIDE, height: PREVIEW_SIDE, fit: 'scale-down'})
      .output({format: 'image/jpeg', quality: 80});
    data = await result.response().arrayBuffer();
  } catch {
    // Images could not decode it; send the original bytes instead.
  }
  return `data:image/jpeg;base64,${b64encode(new Uint8Array(data))}`;
}

function parseLabels(raw: unknown): Labels | null {
  let value = raw;
  if (typeof value === 'string') {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      value = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.sexual !== 'boolean' || typeof v.gore !== 'boolean' || typeof v.animal !== 'boolean') return null;
  return {sexual: v.sexual, gore: v.gore, animal: v.animal};
}

export async function classifyImage(env: Env, data: ArrayBuffer, guest: boolean): Promise<Verdict> {
  let output = '';
  try {
    const run = env.AI.run(MODEL, {
      messages: [
        {role: 'system', content: PROMPT},
        {
          role: 'user',
          content: [
            {type: 'text', text: 'Classify this image.'},
            {type: 'image_url', image_url: {url: await preview(env, data)}},
          ],
        },
      ],
      response_format: {type: 'json_schema', json_schema: SCHEMA},
      max_tokens: 60,
      temperature: 0,
    } as never);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    const result = (await Promise.race([run, timeout])) as {response?: unknown};
    output = typeof result.response === 'string' ? result.response : JSON.stringify(result.response ?? result);
    return decide(parseLabels(result.response), guest, output.slice(0, 500));
  } catch (err) {
    console.error(JSON.stringify({msg: 'image moderation failed', error: String(err)}));
    return decide(null, guest, String(err).slice(0, 500));
  }
}

export async function logModeration(
  db: Db,
  v: Verdict,
  meta: {filename: string | null; uploaderId: string | null; ipHash: string | null; guest: boolean},
) {
  await db.insert('image_moderation', {
    id: uuid(),
    filename: meta.filename,
    uploader_id: meta.uploaderId,
    ip_hash: meta.ipHash,
    is_guest: meta.guest ? 1 : 0,
    verdict: v.verdict,
    reason: v.reason,
    model_output: v.output,
    created_at: now(),
  });
}

export function rejectionError(v: Verdict): AppError {
  if (v.reason === 'sexual') return new AppError(422, 'UPLOAD_INAPPROPRIATE', 'Image rejected: inappropriate content');
  if (v.reason === 'no_animal') return new AppError(422, 'UPLOAD_NO_ANIMAL', 'Image rejected: no animal found');
  return new AppError(503, 'UPLOAD_CHECK_UNAVAILABLE', 'Image check is unavailable, please try again');
}
