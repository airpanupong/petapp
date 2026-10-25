import {createContext, createElement, ReactNode, useContext, useEffect, useRef, useState} from 'react';

/** Same length as the pet-dog / pet-cat / pet-logo assemble in pet-loader.css. */
export const PET_ASSEMBLE_MS = 1800;

const AssembleOwnerContext = createContext<number | null>(null);

const startListeners = new Set<(id: number, at: number) => void>();
const doneListeners = new Set<(id: number) => void>();

let nextAssembleId = 1;

export function AssembleScope({id, children}: {id: number; children: ReactNode}) {
  return createElement(AssembleOwnerContext.Provider, {value: id}, children);
}

export function useAssembleOwner() {
  return useContext(AssembleOwnerContext);
}

export function notifyAssembleStart(id: number) {
  const at = performance.now();
  startListeners.forEach(listener => listener(id, at));
}

export function notifyAssembleDone(id: number) {
  doneListeners.forEach(listener => listener(id));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type AssembleHold = {show: boolean; id: number};

/**
 * Keep a loader on screen until its own assemble finishes. A fast response must
 * not cut the pets off mid-cycle. Reduced motion skips the wait. A cycle that
 * already finished while data was still loading does not replay.
 */
export function useAssembleHold(active: boolean): AssembleHold {
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextAssembleId++;
  const engaged = useRef(false);
  const finished = useRef(false);
  const startedAt = useRef<number | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(n => n + 1);

  if (active && !finished.current) engaged.current = true;

  useEffect(() => {
    const id = idRef.current;
    const onStart = (owner: number, at: number) => {
      if (owner !== id || !engaged.current || finished.current || startedAt.current != null) return;
      startedAt.current = at;
      refresh();
    };
    const onDone = (owner: number) => {
      if (owner !== id || !engaged.current || finished.current || startedAt.current == null) return;
      finished.current = true;
      engaged.current = false;
      startedAt.current = null;
      refresh();
    };
    startListeners.add(onStart);
    doneListeners.add(onDone);
    return () => {
      startListeners.delete(onStart);
      doneListeners.delete(onDone);
    };
  }, []);

  const reduced = prefersReducedMotion();
  const show = active || (engaged.current && !finished.current && !reduced);

  useEffect(() => {
    if (reduced) {
      if (!active) {
        finished.current = false;
        engaged.current = false;
        startedAt.current = null;
      }
      return;
    }
    if (!active && finished.current) {
      finished.current = false;
      engaged.current = false;
      startedAt.current = null;
      return;
    }
    if (active || finished.current || !engaged.current) return;
    const limit = startedAt.current == null
      ? 1000
      : Math.max(0, PET_ASSEMBLE_MS + 80 - (performance.now() - startedAt.current));
    const id = window.setTimeout(() => {
      finished.current = true;
      engaged.current = false;
      startedAt.current = null;
      refresh();
    }, limit);
    return () => window.clearTimeout(id);
  }, [active, reduced, version]);

  return {show, id: idRef.current};
}
