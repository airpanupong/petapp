import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three';
import {Globe2, LocateFixed, Minus, Plus, X} from 'lucide-react';

import type {LatLng, MapMarker} from './MapView';
import {GLOBE_ENTER_DISTANCE} from '../lib/mapImagery';

/** Zooming in closer than this returns to the flat street map. */
const ENTER_MAP_DISTANCE = 1.72;

/** Safari / iOS often rejects the first WebGL attempt (StrictMode remount, GPU pressure). */
function createGlobeRenderer(mobile: boolean): WebGLRenderer {
  const canvas = document.createElement('canvas');
  const attrs: WebGLContextAttributes = {
    alpha: false,
    antialias: !mobile,
    depth: true,
    stencil: false,
    powerPreference: mobile ? 'low-power' : 'default',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
  };

  const gl =
    canvas.getContext('webgl2', attrs) ||
    canvas.getContext('webgl', attrs) ||
    canvas.getContext('experimental-webgl', attrs as WebGLContextAttributes);

  if (!gl) {
    throw new Error('อุปกรณ์นี้ยังเปิด WebGL สำหรับมุมมองโลกไม่ได้');
  }

  const attempts: WebGLRendererParameters[] = [
    {canvas, context: gl as WebGLRenderingContext, antialias: !mobile, alpha: false, powerPreference: mobile ? 'low-power' : 'default'},
    {canvas, antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false},
    {antialias: false, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false},
  ];

  let last: unknown;
  for (const opts of attempts) {
    try {
      const renderer = new WebGLRenderer(opts);
      if (!renderer.getContext()) throw new Error('empty WebGL context');
      return renderer;
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error('THREE.WebGLRenderer: Error creating WebGL context.');
}

function forceLoseWebGL(renderer: WebGLRenderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl?.getExtension?.('WEBGL_lose_context') as {loseContext?: () => void} | null;
    ext?.loseContext?.();
  } catch {
    /* ignore */
  }
  try {
    renderer.dispose();
  } catch {
    /* ignore */
  }
}

function waitForHostSize(host: HTMLElement, signal: {cancelled: boolean}) {
  return new Promise<void>(resolve => {
    const tick = () => {
      if (signal.cancelled) return resolve();
      if (host.clientWidth > 2 && host.clientHeight > 2) return resolve();
      requestAnimationFrame(tick);
    };
    // Let layout settle after showing the globe layer (avoids 0×0 canvas on first paint).
    requestAnimationFrame(() => requestAnimationFrame(tick));
  });
}

const KIND_COLOR: Record<MapMarker['kind'], string> = {
  lost: '#f2657f',
  found: '#3db892',
  sighting: '#e8b84a',
  me: '#5b8def',
};

type Props = {
  center: LatLng;
  markers: MapMarker[];
  userPosition?: LatLng | null;
  onBackToMap: () => void;
  onLocate?: () => void;
  className?: string;
  /** When true, globe is the active view — nudge camera to handoff distance. */
  active?: boolean;
};

type Engine = {
  rebuildMarkers: (markers: MapMarker[], user: LatLng | null | undefined) => void;
  lookAt: (lat: number, lng: number) => void;
  zoomBy: (factor: number) => void;
  getDistance: () => number;
  setDistance: (d: number) => void;
};

type SharedCam = {targetDistance: number; targetRotX: number; targetRotY: number};

function latLngToVec(lat: number, lng: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new Vector3(-(radius * Math.sin(phi) * Math.cos(theta)), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

/** Soft atlas-style earth (BUMP-like): pale oceans + muted green land — matches flat map tint. */
function makeProceduralEarth() {
  const w = 1536;
  const h = 768;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  // Soft ocean (not deep navy satellite)
  const ocean = g.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#e8f4fc');
  ocean.addColorStop(0.12, '#b9daf0');
  ocean.addColorStop(0.5, '#9ecceb');
  ocean.addColorStop(0.88, '#b9daf0');
  ocean.addColorStop(1, '#e8f4fc');
  g.fillStyle = ocean;
  g.fillRect(0, 0, w, h);

  const land = (x: number, y: number, rx: number, ry: number, color: string, rot = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  const green = '#c5d9a8';
  const green2 = '#d7e4b8';
  const sand = '#e6d7b8';
  const ice = '#f4f7fb';

  // Continents — soft atlas blobs (equirectangular-ish)
  land(270, 300, 135, 100, green); // N America
  land(300, 280, 50, 70, green2, 0.4);
  land(420, 480, 70, 120, green2); // S America
  land(780, 270, 70, 55, green); // Europe
  land(820, 400, 110, 130, sand); // Africa
  land(820, 360, 90, 60, green2);
  land(1050, 300, 210, 120, green); // Asia
  land(1180, 360, 80, 90, green2);
  land(1230, 500, 90, 55, green2); // Australia
  land(240, 120, 280, 45, ice); // Arctic
  land(768, 710, 380, 50, ice); // Antarctic

  // Subtle continent outline
  g.globalAlpha = 0.12;
  g.strokeStyle = '#7a8f6a';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(820, 400, 110, 130, 0, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  // Latitude guides (tropics / equator) like the reference globe
  g.strokeStyle = 'rgba(90, 120, 150, 0.35)';
  g.setLineDash([6, 8]);
  g.lineWidth = 1.5;
  for (const y of [h * 0.35, h * 0.5, h * 0.65]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.setLineDash([]);
  g.strokeStyle = 'rgba(90, 120, 150, 0.25)';
  g.beginPath();
  g.moveTo(w * 0.5, 0);
  g.lineTo(w * 0.5, h);
  g.stroke();

  // Soft clouds
  g.globalAlpha = 0.14;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 28; i++) {
    land(Math.random() * w, 100 + Math.random() * (h - 200), 30 + Math.random() * 70, 10 + Math.random() * 22, '#ffffff');
  }
  g.globalAlpha = 1;

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Soft glow pin used for the user location. */
function makeDotTexture(hex: string) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.25, hex);
  grd.addColorStop(0.55, `${hex}88`);
  grd.addColorStop(1, `${hex}00`);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Pet pin with teardrop + optional name label for the globe. */
function makePetPinTexture(hex: string, title?: string) {
  const label = (title ?? '').trim().slice(0, 10);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = label ? 160 : 128;
  const g = c.getContext('2d')!;

  // Glow
  const glow = g.createRadialGradient(64, 52, 4, 64, 52, 48);
  glow.addColorStop(0, `${hex}cc`);
  glow.addColorStop(1, `${hex}00`);
  g.fillStyle = glow;
  g.beginPath();
  g.arc(64, 52, 48, 0, Math.PI * 2);
  g.fill();

  // Teardrop pin
  g.translate(64, 44);
  g.rotate(-Math.PI / 4);
  g.fillStyle = hex;
  g.beginPath();
  g.moveTo(0, 28);
  g.arc(0, 0, 22, 0.25 * Math.PI, 1.75 * Math.PI);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, 8, 0, Math.PI * 2);
  g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);

  if (label) {
    g.font = '700 18px "Mitr", "Prompt", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = Math.min(120, g.measureText(label).width + 16);
    g.fillStyle = 'rgba(10, 14, 28, 0.78)';
    g.fillRect(64 - tw / 2, 118, tw, 28);
    g.fillStyle = '#ffffff';
    g.fillText(label, 64, 132);
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBeam(lat: number, lng: number, hex: string, tip = 1.1, opacity = 0.85) {
  const geo = new BufferGeometry().setFromPoints([latLngToVec(lat, lng, 1.005), latLngToVec(lat, lng, tip)]);
  return new Line(geo, new LineBasicMaterial({color: new Color(hex), transparent: true, opacity}));
}

function makeStars(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 60;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(
    geo,
    new PointsMaterial({color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false}),
  );
}

export function GlobeView({center, markers, userPosition, onBackToMap, onLocate, className, active}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const onBackRef = useRef(onBackToMap);
  onBackRef.current = onBackToMap;
  const camRef = useRef<SharedCam>({
    targetDistance: 2.55,
    targetRotY: (-center.longitude * Math.PI) / 180,
    targetRotX: (center.latitude * Math.PI) / 180,
  });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const [picked, setPicked] = useState<{id: string; kind: MapMarker['kind']; title: string; href?: string} | null>(null);
  const [altitudeLabel, setAltitudeLabel] = useState('ใกล้พื้น');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const signal = {cancelled: false};
    let disposed = false;
    let raf = 0;
    let renderer: WebGLRenderer | null = null;
    let earth: Mesh | null = null;
    let atmosphere: Mesh | null = null;
    let clearMarkers: (() => void) | null = null;
    let detach: (() => void) | null = null;
    const cleanupDom = () => {
      while (host.firstChild) host.removeChild(host.firstChild);
      delete host.dataset.globeTextured;
      delete host.dataset.globeTexSize;
      delete host.dataset.globePins;
    };

    const tearDown = () => {
      if (disposed) return;
      disposed = true;
      signal.cancelled = true;
      engineRef.current = null;
      cancelAnimationFrame(raf);
      detach?.();
      detach = null;
      clearMarkers?.();
      if (earth) {
        earth.geometry.dispose();
        (earth.material as MeshBasicMaterial).map?.dispose();
        (earth.material as MeshBasicMaterial).dispose();
        earth = null;
      }
      if (atmosphere) {
        atmosphere.geometry.dispose();
        (atmosphere.material as MeshBasicMaterial).dispose();
        atmosphere = null;
      }
      if (renderer) {
        forceLoseWebGL(renderer);
        renderer = null;
      }
      cleanupDom();
    };

    const boot = async () => {
      setBootError(null);
      setReady(false);
      await waitForHostSize(host, signal);
      if (signal.cancelled) return;
      await new Promise(r => setTimeout(r, 50));
      if (signal.cancelled) return;

      const mobile = window.matchMedia('(max-width: 768px)').matches || navigator.maxTouchPoints > 0;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
      const segs = mobile ? 40 : 72;

      let nextRenderer: WebGLRenderer;
      try {
        nextRenderer = createGlobeRenderer(mobile);
      } catch (err) {
        if (!signal.cancelled) setBootError(err instanceof Error ? err.message : 'เปิด WebGL ไม่สำเร็จ');
        return;
      }
      if (signal.cancelled) {
        forceLoseWebGL(nextRenderer);
        return;
      }

      renderer = nextRenderer;
      renderer.setPixelRatio(dpr);
      renderer.outputColorSpace = SRGBColorSpace;
      cleanupDom();
      host.appendChild(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(0x030712);
      const camera = new PerspectiveCamera(42, 1, 0.1, 200);
      scene.add(makeStars(mobile ? 600 : 1800));

      const earthGroup = new Group();
      scene.add(earthGroup);

      const earthMat = new MeshBasicMaterial({map: makeProceduralEarth()});
      earth = new Mesh(new SphereGeometry(1, segs, segs), earthMat);
      earthGroup.add(earth);
      host.dataset.globeTextured = 'procedural';

      atmosphere = new Mesh(
        new SphereGeometry(1.035, segs / 2, segs / 2),
        new MeshBasicMaterial({color: 0x6ec8ff, transparent: true, opacity: 0.09, depthWrite: false}),
      );
      earthGroup.add(atmosphere);

      const markersGroup = new Group();
      earthGroup.add(markersGroup);

      const raycaster = new Raycaster();
      const pointer = new Vector2();
      const spriteById = new Map<string, Sprite>();
      const metaById = new Map<string, {kind: MapMarker['kind']; title: string; href?: string}>();

      const cam = camRef.current;
      cam.targetDistance = GLOBE_ENTER_DISTANCE;
      cam.targetRotY = (-center.longitude * Math.PI) / 180;
      cam.targetRotX = (center.latitude * Math.PI) / 180;
      let camDistance = GLOBE_ENTER_DISTANCE;
      let rotY = cam.targetRotY;
      let rotX = cam.targetRotX;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let pinch0 = 0;
      let alive = true;
      let visible = true;
      let lastAlt = '';

      const setAltitudeText = (d: number) => {
        const next = d > 5.2 ? 'อวกาศ' : d > 3.4 ? 'เห็นทั้งโลก' : d > 2.6 ? 'ทวีป' : 'ใกล้พื้น';
        if (next === lastAlt) return;
        lastAlt = next;
        setAltitudeLabel(next);
      };

      const applyCamera = () => {
        const phi = Math.PI / 2 - rotX;
        const theta = rotY;
        camera.position.set(camDistance * Math.sin(phi) * Math.sin(theta), camDistance * Math.cos(phi), camDistance * Math.sin(phi) * Math.cos(theta));
        camera.lookAt(0, 0, 0);
      };

      const resize = () => {
        if (!renderer) return;
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };

      clearMarkers = () => {
        while (markersGroup.children.length) {
          const child = markersGroup.children.pop()!;
          markersGroup.remove(child);
          if (child instanceof Sprite) {
            child.material.map?.dispose();
            child.material.dispose();
          }
          if (child instanceof Line) {
            child.geometry.dispose();
            (child.material as LineBasicMaterial).dispose();
          }
        }
        spriteById.clear();
        metaById.clear();
      };

      const rebuildMarkers = (list: MapMarker[], user: LatLng | null | undefined) => {
        clearMarkers?.();
        const all: MapMarker[] = [...list];
        if (user) all.push({id: 'me', position: user, kind: 'me', title: 'ตำแหน่งของคุณ'});

        for (const m of all) {
          const hex = KIND_COLOR[m.kind];
          const tex = m.kind === 'me' ? makeDotTexture(hex) : makePetPinTexture(hex, m.title);
          const mat = new SpriteMaterial({map: tex, transparent: true, depthWrite: false, depthTest: true});
          const sprite = new Sprite(mat);
          sprite.position.copy(latLngToVec(m.position.latitude, m.position.longitude, 1.035));
          const hasLabel = m.kind !== 'me' && !!m.title?.trim();
          sprite.scale.set(m.kind === 'me' ? 0.14 : 0.16, m.kind === 'me' ? 0.14 : hasLabel ? 0.2 : 0.16, 1);
          sprite.userData = {id: m.id};
          markersGroup.add(sprite);
          if (m.kind === 'me') {
            markersGroup.add(makeBeam(m.position.latitude, m.position.longitude, hex, 1.22, 0.95));
            markersGroup.add(makeBeam(m.position.latitude, m.position.longitude, '#ffffff', 1.14, 0.35));
          } else {
            markersGroup.add(makeBeam(m.position.latitude, m.position.longitude, hex));
          }
          spriteById.set(m.id, sprite);
          metaById.set(m.id, {kind: m.kind, title: m.title ?? m.id, href: m.href});
        }
        host.dataset.globePins = String(all.length);
      };

      const lookAt = (lat: number, lng: number) => {
        cam.targetRotY = (-lng * Math.PI) / 180;
        cam.targetRotX = Math.max(-1.2, Math.min(1.2, (lat * Math.PI) / 180));
      };
      const zoomBy = (factor: number) => {
        cam.targetDistance = Math.max(1.45, Math.min(8.5, cam.targetDistance * factor));
        setHint(false);
      };

      const setDistance = (d: number) => {
        cam.targetDistance = Math.max(1.45, Math.min(8.5, d));
      };
      engineRef.current = {rebuildMarkers, lookAt, zoomBy, getDistance: () => cam.targetDistance, setDistance};
      rebuildMarkers(markers, userPosition);

      // Procedural atlas texture — matches soft flat-map tint (not satellite photo).
      host.dataset.globeTextured = 'atlas';

      let enteredMap = false;
      const tick = () => {
        if (!alive || !renderer) return;
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const ease = 0.12;
        camDistance += (cam.targetDistance - camDistance) * ease;
        rotX += (cam.targetRotX - rotX) * ease;
        rotY += (cam.targetRotY - rotY) * ease;
        applyCamera();
        if (!dragging && camDistance > 2.8) earthGroup.rotation.y += mobile ? 0.0002 : 0.00035;
        renderer.render(scene, camera);
        setAltitudeText(camDistance);
        if (!enteredMap && cam.targetDistance <= ENTER_MAP_DISTANCE && camDistance <= ENTER_MAP_DISTANCE + 0.08) {
          enteredMap = true;
          onBackRef.current();
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        host.setPointerCapture(e.pointerId);
        setHint(false);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        cam.targetRotY -= dx * 0.005;
        cam.targetRotX = Math.max(-1.2, Math.min(1.2, cam.targetRotX + dy * 0.004));
      };
      const onPointerUp = (e: PointerEvent) => {
        dragging = false;
        try {
          host.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        cam.targetDistance = Math.max(1.45, Math.min(8.5, cam.targetDistance * (e.deltaY > 0 ? 1.08 : 0.92)));
        setHint(false);
      };
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          dragging = false;
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && pinch0 > 0) {
          e.preventDefault();
          const a = e.touches[0];
          const b = e.touches[1];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const scale = pinch0 / Math.max(dist, 1);
          cam.targetDistance = Math.max(1.45, Math.min(8.5, cam.targetDistance * (0.65 + scale * 0.35)));
          pinch0 = dist;
          setHint(false);
        }
      };
      const pickAt = (clientX: number, clientY: number) => {
        if (!renderer) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([...spriteById.values()], false);
        if (!hits.length) {
          setPicked(null);
          return;
        }
        const id = String(hits[0].object.userData.id);
        const meta = metaById.get(id);
        if (!meta) return;
        setPicked({id, ...meta});
      };
      let downAt = 0;
      let downXY = {x: 0, y: 0};
      const onDownStamp = (e: PointerEvent) => {
        downAt = performance.now();
        downXY = {x: e.clientX, y: e.clientY};
        onPointerDown(e);
      };
      const onUpPick = (e: PointerEvent) => {
        const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
        onPointerUp(e);
        if (performance.now() - downAt < 280 && moved < 10) pickAt(e.clientX, e.clientY);
      };
      const onVis = () => {
        visible = document.visibilityState === 'visible';
      };
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting && document.visibilityState === 'visible';
        },
        {threshold: 0.05},
      );
      io.observe(host);
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      resize();
      applyCamera();
      setAltitudeText(camDistance);
      setReady(true);
      raf = requestAnimationFrame(tick);

      const canvasEl = renderer.domElement;
      host.addEventListener('pointerdown', onDownStamp);
      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerup', onUpPick);
      host.addEventListener('pointercancel', onPointerUp);
      canvasEl.addEventListener('wheel', onWheel, {passive: false});
      canvasEl.addEventListener('touchstart', onTouchStart, {passive: true});
      canvasEl.addEventListener('touchmove', onTouchMove, {passive: false});
      document.addEventListener('visibilitychange', onVis);

      detach = () => {
        alive = false;
        ro.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        host.removeEventListener('pointerdown', onDownStamp);
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerup', onUpPick);
        host.removeEventListener('pointercancel', onPointerUp);
        canvasEl.removeEventListener('wheel', onWheel);
        canvasEl.removeEventListener('touchstart', onTouchStart);
        canvasEl.removeEventListener('touchmove', onTouchMove);
      };
    };

    void boot();
    return tearDown;
    // center is used only for the initial camera; later updates go through lookAt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.rebuildMarkers(markers, userPosition);
  }, [markers, userPosition]);

  useEffect(() => {
    engineRef.current?.lookAt(center.latitude, center.longitude);
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    if (!active) return;
    // Start just above the handoff distance so zoom-out from map feels continuous.
    engineRef.current?.setDistance(GLOBE_ENTER_DISTANCE);
    engineRef.current?.lookAt(center.latitude, center.longitude);
    setHint(true);
  }, [active, center.latitude, center.longitude]);

  if (bootError) {
    return (
      <div className={`globe-shell map-tall globe-fallback ${className ?? ''}`}>
        <Globe2 size={36} />
        <b>เปิดมุมมองโลกไม่สำเร็จ</b>
        <p className="muted small">{bootError}</p>
        <button type="button" className="btn btn-mint" onClick={onBackToMap}>
          กลับแผนที่ใกล้ๆ
        </button>
      </div>
    );
  }

  return (
    <div className={`globe-shell ${className ?? ''}`}>
      <div ref={hostRef} className="globe-canvas" role="img" aria-label="โลก 3 มิติ ลากเพื่อหมุน บีบนิ้วเพื่อซูม" />

      <div className="globe-hud">
        <div className="globe-top">
          <button type="button" className="globe-pill" onClick={onBackToMap}>
            <Globe2 size={15} /> ซูมเข้าแผนที่
          </button>
          <span className="globe-pill globe-pill-static">
            <Globe2 size={15} /> {altitudeLabel}
            {markers.length ? ` · ${markers.length} หมุด` : ''}
          </span>
          <div className="globe-zoom">
            <button
              type="button"
              className="globe-fab"
              onClick={() => {
                camRef.current.targetDistance = Math.max(1.45, camRef.current.targetDistance * 0.82);
                setHint(false);
              }}
              aria-label="ซูมเข้า">
              <Plus size={18} />
            </button>
            <button
              type="button"
              className="globe-fab"
              onClick={() => {
                camRef.current.targetDistance = Math.min(8.5, camRef.current.targetDistance * 1.25);
                setHint(false);
              }}
              aria-label="ซูมออกนอกโลก">
              <Minus size={18} />
            </button>
            {onLocate ? (
              <button type="button" className="globe-fab" onClick={onLocate} aria-label="ไปตำแหน่งของฉัน">
                <LocateFixed size={18} />
              </button>
            ) : null}
          </div>
        </div>

        {hint ? (
          <div className="globe-hint">
            <p>
              <b>ลาก</b> หมุนโลก · <b>ซูมออก</b> ดูจากนอกโลก · <b>ซูมเข้า</b> กลับแผนที่ใกล้ๆ
              {markers.length ? ` · แตะหมุดเพื่อดูน้อง` : ''}
            </p>
            <button type="button" className="globe-hint-close" onClick={() => setHint(false)} aria-label="ปิดคำแนะนำ">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="globe-legend">
          <span>
            <i className="globe-dot me" /> ฉัน
          </span>
          <span>
            <i className="globe-dot lost" /> ตามหา
          </span>
          <span>
            <i className="globe-dot found" /> พบ
          </span>
          <span>
            <i className="globe-dot sighting" /> เบาะแส
          </span>
        </div>

        {picked ? (
          <button
            type="button"
            className={`globe-card tag-${picked.kind}`}
            disabled={!picked.href}
            onClick={() => {
              if (picked.href) navigate(picked.href);
            }}>
            <b>{picked.title}</b>
            <span>{picked.href ? 'แตะเพื่อเปิดประกาศ' : picked.kind === 'me' ? 'คุณอยู่ตรงนี้' : ''}</span>
          </button>
        ) : null}
      </div>

      {!ready ? <div className="globe-loading">กำลังโหลดโลก…</div> : null}
    </div>
  );
}

export default GlobeView;
