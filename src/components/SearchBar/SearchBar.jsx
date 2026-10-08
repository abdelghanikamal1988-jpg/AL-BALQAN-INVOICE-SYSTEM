import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

export default function SearchBar({ value, onChange, placeholder = 'shell.searchDefault', ariaLabel }) {
  const { t } = useLang();
  return (
    <label className="searchbar">
      <span className="searchbar__icon" aria-hidden="true">
        <Icon name="search" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(placeholder)}
        aria-label={t(ariaLabel) || t(placeholder)}
      />
      {value && (
        <button
          type="button"
          className="searchbar__clear"
          aria-label={t('shell.clearSearch')}
          onClick={() => onChange('')}
        >
          <Icon name="x" />
        </button>
      )}
    </label>
  );
}
