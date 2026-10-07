import SearchBar from '../SearchBar/SearchBar.jsx';
import Can from '../Can/Can.jsx';
import Icon from '../Icons/Icon.jsx';

export default function InvoiceHistoryToolbar({ query, onChange, onExport, onImport, onClear }) {
  return (
    <div className="history-toolbar">
      <div className="history-toolbar__search">
        <SearchBar value={query} onChange={onChange} placeholder="Search by invoice no., customer, passport or phone…" />
      </div>
      <Can perm="action:invoice.export">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onExport}>
          <Icon name="download" aria-hidden="true" />
          Export Data
        </button>
      </Can>
      <Can perm="action:invoice.import">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onImport}>
          <Icon name="upload" aria-hidden="true" />
          Import Data
        </button>
      </Can>
      {onClear && (
        <button type="button" className="btn btn--neutral btn--sm" onClick={onClear}>
          Clear Search
        </button>
      )}
    </div>
  );
}
