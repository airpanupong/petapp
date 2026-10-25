import {mascotSrc} from '../components/PetMascot';

export type PinKind = 'lost' | 'found' | 'sighting' | 'me';

export const PIN_COLOR: Record<PinKind, string> = {
  lost: '#f2657f',
  found: '#3db892',
  sighting: '#e8b84a',
  me: '#2f7bf5',
};

export const PIN_LABEL: Record<PinKind, string> = {
  lost: 'ตามหา',
  found: 'พบ',
  sighting: 'เบาะแส',
  me: 'ฉัน',
};

const GLYPH: Record<PinKind, string> = {
  lost: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 12a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5"/><path d="M12 7v10"/><path d="M5 19h14"/><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  found: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  sighting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
  me: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
};

/** HTML for a teardrop map pin (Leaflet DivIcon / MapLibre Marker). */
export function pinInnerHtml(kind: PinKind, animal?: string | null) {
  const color = PIN_COLOR[kind];
  const face = animal
    ? `<img class="map-pin-face" src="${mascotSrc(animal, true)}" alt="" draggable="false" />`
    : `<span class="map-pin-glyph">${GLYPH[kind]}</span>`;
  return `<div class="map-pin-anchor" style="--pin:${color}">
    <span class="map-pin-halo" aria-hidden="true"></span>
    <div class="map-pin kind-${kind}">${face}</div>
  </div>`;
}

export function pinPopupHtml(kind: PinKind, title: string, href?: string) {
  const safeTitle = escapeHtml(title);
  const body = href
    ? `<a class="pin-popup-link" href="${escapeAttr(href)}">${safeTitle}</a>`
    : `<span>${safeTitle}</span>`;
  return `<div class="pin-popup ml-popup">
    <span class="pin-popup-tag tag-${kind}">${PIN_LABEL[kind]}</span>
    <div class="pin-popup-body">${body}</div>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** Pin visual scale vs map zoom (smaller on globe). */
export function pinScaleForZoom(z: number) {
  if (z <= 3) return 0.42;
  if (z <= 5) return 0.55;
  if (z <= 8) return 0.7;
  if (z <= 11) return 0.86;
  return 1;
}
