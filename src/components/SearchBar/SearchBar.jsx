import Icon from '../Icons/Icon.jsx';

export default function SearchBar({ value, onChange, placeholder = 'Search…', ariaLabel }) {
  return (
    <label className="searchbar">
      <span className="searchbar__icon" aria-hidden="true">
        <Icon name="search" />
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
          <Icon name="x" />
        </button>
      )}
    </label>
  );
}
