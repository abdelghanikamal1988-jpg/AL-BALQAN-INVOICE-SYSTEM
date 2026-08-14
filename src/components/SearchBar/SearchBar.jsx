export default function SearchBar({ value, onChange, placeholder = 'Search…', ariaLabel }) {
  return (
    <label className="searchbar">
      <span className="searchbar__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
      />
      {value && (
        <button type="button" className="searchbar__clear" aria-label="Clear search" onClick={() => onChange('')}>
          ×
        </button>
      )}
    </label>
  );
}
