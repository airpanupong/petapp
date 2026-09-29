import './cat-loader.css';

type Props = {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
};

const PAW_COUNT = 7;

function WalkingCat() {
  return (
    <svg className="cat-svg" viewBox="0 0 120 84" aria-hidden="true">
      <g className="cat-tail">
        <path d="M30 44 C 14 42, 8 24, 20 14" />
      </g>

      <g className="cat-legs">
        <rect className="leg leg-back-far" x="36" y="50" width="8" height="20" rx="4" />
        <rect className="leg leg-front-far" x="72" y="50" width="8" height="20" rx="4" />
      </g>

      <g className="cat-body">
        <ellipse cx="56" cy="47" rx="29" ry="15" fill="#FFB36B" />
        <ellipse cx="59" cy="53" rx="19" ry="8" fill="#FFE4C7" />
        <path d="M46 34 q3 5 0 9 M55 32 q3 6 0 10 M64 33 q3 5 0 9" stroke="#F2954A" strokeWidth="3" strokeLinecap="round" fill="none" />

        <g className="cat-head">
          <polygon points="74,26 76,8 88,20" fill="#FFB36B" />
          <polygon points="90,20 101,8 102,27" fill="#FFB36B" />
          <polygon points="77,22 78,13 84,19" fill="#FF9FB1" />
          <polygon points="93,19 99,13 99,23" fill="#FF9FB1" />
          <circle cx="88" cy="35" r="16" fill="#FFB36B" />
          <ellipse cx="91" cy="41" rx="9" ry="6" fill="#FFE4C7" />
          <g className="cat-eyes">
            <ellipse cx="84" cy="33" rx="2.2" ry="2.8" fill="#4B3A36" />
            <ellipse cx="96" cy="33" rx="2.2" ry="2.8" fill="#4B3A36" />
            <circle cx="84.8" cy="32" r="0.8" fill="#fff" />
            <circle cx="96.8" cy="32" r="0.8" fill="#fff" />
          </g>
          <circle cx="79" cy="40" r="3" fill="#FF9FB1" opacity="0.7" />
          <circle cx="101" cy="40" r="3" fill="#FF9FB1" opacity="0.7" />
          <path d="M88.5 38.5 l2.5 0 l-1.25 1.8 z" fill="#F2657F" />
          <path d="M89.75 40.3 q-1.6 2 -3.2 0.6 M89.75 40.3 q1.6 2 3.2 0.6" stroke="#4B3A36" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M104 38 l9 -2 M104 41 l9 1 M77 37.5 l-4 -1 M77 40.5 l-4 0.6" stroke="#C98A5B" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>

      <g className="cat-legs">
        <rect className="leg leg-back-near" x="42" y="52" width="8.5" height="20" rx="4.2" />
        <rect className="leg leg-front-near" x="78" y="52" width="8.5" height="20" rx="4.2" />
      </g>
    </svg>
  );
}

function Paw() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="5" ry="4.2" />
      <ellipse cx="5.6" cy="10.2" rx="2" ry="2.6" />
      <ellipse cx="18.4" cy="10.2" rx="2" ry="2.6" />
      <ellipse cx="9" cy="6" rx="1.8" ry="2.4" />
      <ellipse cx="15" cy="6" rx="1.8" ry="2.4" />
    </svg>
  );
}

function CatTrack() {
  return (
    <div className="cat-track">
      <div className="cat-walker">
        <WalkingCat />
      </div>
      <div className="cat-paws">
        {Array.from({length: PAW_COUNT}, (_, i) => (
          <span
            key={i}
            className={`cat-paw ${i % 2 ? 'odd' : ''}`}
            style={{left: `${((i + 0.5) / PAW_COUNT) * 100}%`, animationDelay: `${(i / PAW_COUNT) * 4.2}s`}}>
            <Paw />
          </span>
        ))}
      </div>
      <div className="cat-ground" />
    </div>
  );
}

export function CatWalk({size = 'md'}: {size?: Props['size']}) {
  return (
    <div className={`cat-loader cat-${size}`} aria-hidden="true">
      <CatTrack />
    </div>
  );
}

export function CatLoader({label = 'กำลังโหลด...', size = 'md', fullscreen = false}: Props) {
  const content = (
    <div className={`cat-loader cat-${size}`} role="status" aria-live="polite">
      <CatTrack />
      {label ? (
        <p className="cat-label">
          {label}
          <span className="cat-dots">
            <i />
            <i />
            <i />
          </span>
        </p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return <div className="cat-fullscreen">{content}</div>;
  }
  return content;
}
