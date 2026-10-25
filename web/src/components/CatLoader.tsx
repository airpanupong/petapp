import './cat-loader.css';

type Size = 'sm' | 'md' | 'lg';
type Pet = 'cat' | 'dog' | 'turtle' | 'rabbit' | 'capybara';
const PETS: Pet[] = ['cat', 'dog', 'turtle', 'rabbit', 'capybara'];
const COATS: Record<Pet, [string, string]> = {
  cat: ['#ffbd80', '#e89b5f'],
  dog: ['#eac094', '#bd875f'],
  turtle: ['#b6d99b', '#86b775'],
  rabbit: ['#fff0e9', '#e8c9bd'],
  capybara: ['#cfa783', '#ad8160'],
};

function PetFace({kind}: {kind: Pet}) {
  const sleepy = kind === 'capybara';
  return (
    <>
      <ellipse cx="75" cy="54" rx="4.5" ry="2.8" fill="#f3a5a8" opacity=".8" />
      <ellipse cx="100" cy="54" rx="4.5" ry="2.8" fill="#f3a5a8" opacity=".8" />
      <g className="pet-parade__eyes" fill="#59453d">
        {sleepy ? <path d="M76 47q3 3 6 0m11 0q3 3 6 0" fill="none" stroke="#59453d" strokeWidth="2.5" strokeLinecap="round" /> : <>
          <ellipse cx="79" cy="47" rx="3.5" ry="4.5" />
          <ellipse cx="96" cy="47" rx="3.5" ry="4.5" />
          <circle cx="80" cy="45.5" r="1.4" fill="white" />
          <circle cx="97" cy="45.5" r="1.4" fill="white" />
        </>}
      </g>
      {kind === 'turtle' ? <path d="M84 55q4 4 8 0" fill="none" stroke="#59453d" strokeWidth="1.8" strokeLinecap="round" /> : <>
        <ellipse cx="87.5" cy="56" rx={sleepy ? 10 : 8} ry="6" fill={sleepy ? '#e3c3a3' : '#fff5e8'} />
        <path d="M85 53q2.5-2 5 0l-2.5 2.5Z" fill={kind === 'dog' || sleepy ? '#6b5043' : '#dc8b92'} />
        <path d="M87.5 55.5v1m0 0q-2 3-4 0m4 0q2 3 4 0" fill="none" stroke="#6b5043" strokeWidth="1.3" strokeLinecap="round" />
      </>}
    </>
  );
}

function WalkingPet({kind}: {kind: Pet}) {
  const [coat, shade] = COATS[kind];
  const turtle = kind === 'turtle';
  return (
    <svg className={`pet-parade__pet pet-parade__pet--${kind}`} viewBox="0 0 120 100" aria-hidden="true">
      <ellipse className="pet-parade__shadow" cx="62" cy="87" rx="37" ry="3.5" fill="#d9bfb2" opacity=".18" />
      <g fill={shade}>
        <rect className="pet-parade__leg pet-parade__leg--far" x="37" y="67" width="11" height="18" rx="5.5" />
        <rect className="pet-parade__leg" x="76" y="67" width="11" height="18" rx="5.5" />
      </g>
      <g className="pet-parade__body">
        {kind === 'cat' && <path className="pet-parade__tail" d="M34 65C12 67 12 45 22 40" fill="none" stroke={coat} strokeWidth="10" strokeLinecap="round" />}
        {kind === 'dog' && <path className="pet-parade__tail" d="M34 64Q14 62 20 48" fill="none" stroke={shade} strokeWidth="11" strokeLinecap="round" />}
        {kind === 'rabbit' && <circle cx="28" cy="67" r="9" fill="#fffaf6" stroke="#eddbd1" strokeWidth="1.5" />}
        {turtle && <path d="m28 72-12 3 15 4" fill={coat} />}
        <ellipse cx="56" cy="65" rx="30" ry="18" fill={coat} />
        {!turtle && <ellipse cx="59" cy="71" rx="19" ry="10" fill={kind === 'capybara' ? '#dfbb97' : '#fff0dc'} />}
        {kind === 'cat' && <path d="m43 50 2 7m9-9 1 7m10-5-1 7" stroke={shade} strokeWidth="4" strokeLinecap="round" />}
        {turtle && <>
          <path d="M25 70C23 35 76 31 83 70Z" fill="#88b591" />
          <path d="m48 45-9 13 8 13h17l9-13-10-13Zm-9 13-12-1m46 1 7-1M47 71l-5 5m22-5 5 5" fill="none" stroke="#639879" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M25 71q29 10 58 0" fill="none" stroke="#cde1a7" strokeWidth="6" strokeLinecap="round" />
        </>}
        <g className="pet-parade__head">
          {kind === 'cat' && <>
            <path d="M64 39 65 17Q66 13 71 18L83 29M90 29l13-13q4-3 4 3l3 24" fill={coat} />
            <path d="m69 32 0-10 10 10m17 0 7-11 1 14" fill="#efa4aa" strokeLinejoin="round" />
          </>}
          {kind === 'rabbit' && <>
            <ellipse cx="75" cy="22" rx="8" ry="21" transform="rotate(-12 75 22)" fill={coat} />
            <ellipse cx="96" cy="21" rx="8" ry="21" transform="rotate(9 96 21)" fill={coat} />
            <ellipse cx="75" cy="21" rx="3.5" ry="14" transform="rotate(-12 75 22)" fill="#efb3b6" />
            <ellipse cx="96" cy="20" rx="3.5" ry="14" transform="rotate(9 96 21)" fill="#efb3b6" />
          </>}
          {kind === 'capybara' && <>
            <circle cx="73" cy="31" r="7" fill={coat} /><circle cx="98" cy="30" r="7" fill={coat} />
            <circle cx="73" cy="31" r="3.5" fill={shade} /><circle cx="98" cy="30" r="3.5" fill={shade} />
          </>}
          <rect x="64" y={turtle ? 35 : 28} width="45" height={turtle ? 32 : 40} rx={kind === 'capybara' ? 16 : 20} fill={coat} />
          {kind === 'dog' && <>
            <ellipse cx="67" cy="43" rx="8" ry="17" transform="rotate(15 67 43)" fill={shade} />
            <ellipse cx="104" cy="43" rx="7" ry="16" transform="rotate(-12 104 43)" fill={shade} />
            <path d="M85 29q-5 10 0 16h7q5-8-1-16" fill="#fff0dc" />
          </>}
          {kind === 'cat' && <path d="m82 30 1 6m7-6-1 6" stroke={shade} strokeWidth="3" strokeLinecap="round" />}
          <PetFace kind={kind} />
          {kind === 'cat' && <path d="m68 52-8-2m8 6-8 1m46-5 8-2m-8 6 8 1" fill="none" stroke="#bc8b70" strokeWidth="1.3" strokeLinecap="round" />}
          {kind === 'capybara' && <>
            <circle cx="86" cy="23" r="7" fill="#f5ad60" />
            <path d="M86 16q2-6 8-3-3 5-8 3" fill="#86ad79" />
          </>}
        </g>
      </g>
      <g fill={coat}>
        <rect className="pet-parade__leg" x="40" y="69" width="12" height="17" rx="6" />
        <rect className="pet-parade__leg pet-parade__leg--far" x="78" y="69" width="12" height="17" rx="6" />
      </g>
    </svg>
  );
}

/** Decorative friends shared by empty states. Keep the existing API for callers. */
export function CatWalk({size = 'md'}: {size?: Size}) {
  return (
    <div className={`pet-parade pet-parade--${size}`} aria-hidden="true">
      <div className="pet-parade__friends">
        {PETS.map(kind => <WalkingPet key={kind} kind={kind} />)}
      </div>
      <div className="pet-parade__ground" />
    </div>
  );
}

export {PetLoader as CatLoader} from './PetLoader';
