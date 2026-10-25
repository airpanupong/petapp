import './home-pet-scene.css';

/** Both 4 × 4 sprite sheets share a timeline; poses change within each character. */
export function PetScene({variant = 'home'}: {variant?: 'home' | 'gate' | 'auth' | 'compact'}) {
  return (
    <div className={`pet-scene pet-scene--${variant}${variant === 'home' ? ' home-head-pets' : ''}`} aria-hidden="true">
      <span className="plush-pet plush-puppy">
        <span className="pet-sprite puppy-sprite" />
        <svg className="plush-surprise" viewBox="0 0 50 30" fill="none">
          <path d="M10 23L5 15M25 16V5M40 23L45 15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="plush-pet plush-kitten">
        <span className="pet-sprite kitten-sprite" />
      </span>
    </div>
  );
}
