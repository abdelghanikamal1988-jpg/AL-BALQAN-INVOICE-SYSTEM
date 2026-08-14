import SearchBar from '../SearchBar/SearchBar.jsx';

export default function InvoiceHistoryToolbar({ query, onChange, onExport, onImport, onClear }) {
  return (
    <div className="history-toolbar">
      <div className="history-toolbar__search">
        <SearchBar value={query} onChange={onChange} placeholder="Search by invoice no., customer, passport or phone…" />
      </div>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onExport}>
        Export Data
      </button>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onImport}>
        Import Data
      </button>
      {onClear && (
        <button type="button" className="btn btn--neutral btn--sm" onClick={onClear}>
          Clear Search
        </button>
      )}
    </div>
  );
}
