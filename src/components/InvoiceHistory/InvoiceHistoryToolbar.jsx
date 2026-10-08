import SearchBar from '../SearchBar/SearchBar.jsx';
import Can from '../Can/Can.jsx';
import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

export default function InvoiceHistoryToolbar({ query, onChange, onExport, onImport, onClear }) {
  const { t } = useLang();
  return (
    <div className="history-toolbar">
      <div className="history-toolbar__search">
        <SearchBar value={query} onChange={onChange} placeholder={t('invoice.searchPlaceholder')} />
      </div>
      <Can perm="action:invoice.export">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onExport}>
          <Icon name="download" aria-hidden="true" />
          {t('invoice.exportData')}
        </button>
      </Can>
      <Can perm="action:invoice.import">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onImport}>
          <Icon name="upload" aria-hidden="true" />
          {t('invoice.importData')}
        </button>
      </Can>
      {onClear && (
        <button type="button" className="btn btn--neutral btn--sm" onClick={onClear}>
          {t('invoice.clearSearch')}
        </button>
      )}
    </div>
  );
}
