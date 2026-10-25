import {useEffect, useRef, useState} from 'react';
import logo from '../assets/pet-logo.png';
import sprites from '../assets/pet-sprites.png';
import {notifyAssembleDone, notifyAssembleStart, useAssembleOwner} from '../lib/assembleHold';
import './pet-loader.css';

type Props = {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
};

/** Shared Pet haii loader: assemble once, then gently breathe while waiting. */
export function PetLoader({label = 'กำลังโหลด…', size = 'md', fullscreen = false}: Props) {
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const owner = useAssembleOwner();
  useEffect(() => {
    let active = true;
    // Start both layers together, including on a cold cache / slow connection.
    Promise.all([logo, sprites].map(src => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => undefined);
    })).then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || owner == null) return;
    const root = rootRef.current;
    if (!root) return;
    let dog: Element | null = null;
    let armed = false;
    let watch = 0;
    const onEnd = (event: Event) => {
      if (event.target !== dog) return;
      notifyAssembleDone(owner);
    };
    const arm = () => {
      if (armed || root.getClientRects().length === 0) return;
      armed = true;
      window.clearInterval(watch);
      notifyAssembleStart(owner);
      dog = root.querySelector('.pet-loader__dog');
      dog?.addEventListener('animationend', onEnd);
    };
    arm();
    if (!armed) watch = window.setInterval(arm, 50);
    return () => {
      window.clearInterval(watch);
      dog?.removeEventListener('animationend', onEnd);
    };
  }, [ready, owner]);

  const content = (
    <div ref={rootRef} className={`pet-loader pet-loader--${size}${ready ? ' is-ready' : ''}`} role="status" aria-live="polite" aria-label={label || 'กำลังโหลด'}>
      <div className="pet-loader__frame" aria-hidden="true">
        <div className="pet-loader__stage">
          <div className="pet-loader__artwork">
            <div className="pet-loader__halo" />
            <div className="pet-loader__dog"><img src={sprites} alt="" draggable={false} /></div>
            <div className="pet-loader__cat"><img src={sprites} alt="" draggable={false} /></div>
            <img className="pet-loader__logo" src={logo} alt="" draggable={false} />
          </div>
        </div>
      </div>
      {fullscreen && <div className="pet-loader__brand" aria-hidden="true"><strong>Pet haii</strong><span>พาน้องกลับบ้าน</span></div>}
      <div className="pet-loader__dots" aria-hidden="true"><i /><i /><i /></div>
      {label && <p className="pet-loader__label">{label}</p>}
    </div>
  );
  return fullscreen ? <div className="pet-loader-screen">{content}</div> : content;
}
