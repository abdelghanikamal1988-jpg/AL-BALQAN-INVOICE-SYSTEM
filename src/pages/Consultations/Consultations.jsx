import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  dbFetchConsultations,
  dbUpdateConsultation,
  syncNetlifyForms,
} from '../../lib/consultationRepo.js';
import { formatDate, formatDateTimeDisplay } from '../../utils/formatDate.js';
import { whatsappShareUrl } from '../../utils/whatsapp.js';
import '../../styles/consultations.css';

const ANY = '';
const STATUSES = ['new', 'in_progress', 'done', 'archived'];
const LAST_SYNC_KEY = 'albalqan:consult:lastSync';

const STATUS_TILE = {
  new: { tile: 'slate', glyph: 'note' },
  in_progress: { tile: 'amber', glyph: 'clock' },
  done: { tile: 'green', glyph: 'check' },
  archived: { tile: 'slate', glyph: 'folder' },
};

const KNOWN_RAW_KEYS = new Set([
  'fullname',
  'name',
  'yourname',
  'customername',
  'contactname',
  'email',
  'emailaddress',
  'mail',
  'emailid',
  'phone',
  'phonenumber',
  'mobile',
  'mobilenumber',
  'whatsapp',
  'contactnumber',
  'tel',
  'nationality',
  'country',
  'destination',
  'countryofdestination',
  'residence',
  'countryofresidence',
  'service',
  'servicetype',
  'pathway',
  'details',
  'message',
  'consent',
  'agree',
]);

const SLUG_KEYS = new Set(['country', 'destination', 'service', 'servicetype', 'pathway']);

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function prettyKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanSlug(value) {
  const text = String(value).trim();
  if (!text.includes('-')) return text;
  return text.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export default function Consultations() {
  const { t } = useLang();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [country, setCountry] = useState(ANY);
  const [service, setService] = useState(ANY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ status: 'new', notes: '' });
  const [saving, setSaving] = useState(false);
  const syncInFlight = useRef(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await dbFetchConsultations();
      setRows(list);
    } catch (err) {
      console.error(err);
      setRows([]);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) await runSync(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (country && (row.country || '') !== country) return false;
      if (service && (row.service || '') !== service) return false;
      if (needle) {
        const haystack = [row.full_name, row.phone, row.email]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, query, status, country, service]);

  const stats = useMemo(() => {
    const counts = { new: 0, in_progress: 0, done: 0, archived: 0 };
    rows.forEach((row) => {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    return { total: rows.length, counts };
  }, [rows]);

  const countryOptions = useMemo(() => {
    const seen = new Set();
    rows.forEach((row) => {
      const value = String(row.country || '').trim();
      if (value) seen.add(value);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const serviceOptions = useMemo(() => {
    const seen = new Set();
    rows.forEach((row) => {
      const value = String(row.service || '').trim();
      if (value) seen.add(value);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const hasFilters = Boolean(query || status || country || service);
  const clearFilters = () => {
    setQuery(ANY);
    setStatus(ANY);
    setCountry(ANY);
    setService(ANY);
  };

  const syncErrorMessage = (err) => {
    const code = err?.code ? String(err.code) : '';
    const key = code ? `consultations.err.${code}` : '';
    const viaKey = key ? t(key) : '';
    if (viaKey && viaKey !== key) {
      if (code === 'sync_failed' && err?.message) return `${viaKey} — ${err.message}`;
      return viaKey;
    }
    if (err?.message) return `${t('consultations.err.sync_failed')} — ${err.message}`;
    return t('consultations.err.sync_failed');
  };

  const runSync = async (silent) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const result = await syncNetlifyForms();
      const info = {
        at: new Date().toISOString(),
        newCount: Number(result?.synced_new ?? 0),
        total: Number(result?.total_fetched ?? 0),
      };
      setSyncInfo(info);
      try {
        localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(info));
      } catch {
        /* storage unavailable */
      }
      if (!silent || info.newCount > 0) {
        toast.success(t('consultations.toastSynced', { n: info.newCount, total: info.total }));
      }
      await load();
    } catch (err) {
      console.error(err);
      if (!silent) toast.error(syncErrorMessage(err));
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  };

  const handleSync = () => runSync(false);

  const openDetail = (row) => {
    setSelected(row);
    setDraft({ status: row.status || 'new', notes: row.notes || '' });
  };

  const closeDetail = () => setSelected(null);

  const saveDetail = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await dbUpdateConsultation(selected.id, { status: draft.status, notes: draft.notes });
      setRows((prev) =>
        prev.map((row) =>
          row.id === selected.id ? { ...row, status: draft.status, notes: draft.notes } : row
        )
      );
      setSelected((prev) => ({ ...prev, status: draft.status, notes: draft.notes }));
      toast.success(t('consultations.toastSaved'));
    } catch (err) {
      console.error(err);
      toast.error(err?.message || t('consultations.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const renderValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
    if (Array.isArray(value)) return value.map((item) => renderValue(key, item)).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    if (SLUG_KEYS.has(normalizeKey(key))) return humanSlug(String(value));
    return String(value);
  };

  const initialsOf = (name) => {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  const exportCsv = () => {
    const fixed = [
      'submitted_at',
      'full_name',
      'email',
      'phone',
      'nationality',
      'country',
      'residence',
      'service',
      'status',
      'consent',
      'details',
      'notes',
    ];
    const extras = [];
    visible.forEach((row) => {
      Object.keys(row.raw_data || {}).forEach((key) => {
        if (!KNOWN_RAW_KEYS.has(normalizeKey(key)) && !extras.includes(key)) extras.push(key);
      });
    });
    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = [...fixed, ...extras];
    const lines = [header.map(esc).join(',')];
    visible.forEach((row) => {
      const raw = row.raw_data || {};
      const cells = fixed.map((column) => {
        if (column === 'submitted_at') return row.submitted_at || '';
        if (column === 'status') return row.status || '';
        if (column === 'consent') {
          if (row.consent === true) return t('common.yes');
          if (row.consent === false) return t('common.no');
          return '';
        }
        if (column === 'notes') return row.notes || '';
        if (row[column] !== undefined && row[column] !== null) return row[column];
        return raw[column] ?? '';
      });
      extras.forEach((key) => cells.push(raw[key] ?? ''));
      lines.push(cells.map(esc).join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `consultation-requests-${formatDate(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const detailWhatsUrl =
    selected && selected.phone
      ? whatsappShareUrl(selected.phone, t('consultations.waText', {
          name: selected.full_name || '—',
        }))
      : '';
  const rawEntries = selected ? Object.entries(selected.raw_data || {}) : [];

  return (
    <div className="page page--wide consultations-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">WEBSITE</p>
          <h1>{t('consultations.title')}</h1>
          <p className="subtitle">{t('consultations.subtitle')}</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">{t('consultations.home')}</Link>
            </li>
            <li>
              <span className="crumbs__cur">{t('consultations.title')}</span>
            </li>
          </ul>
          <button
            type="button"
            className="btn btn--primary cs-sync"
            onClick={handleSync}
            disabled={syncing}
            aria-label={t('consultations.sync')}
          >
            <Icon name="upload" aria-hidden="true" />
            {syncing ? t('consultations.syncing') : t('consultations.sync')}
          </button>
        </div>
      </div>

      {syncInfo && (
        <p className="cs-lastsync">
          {t('consultations.lastSync', {
            at: formatDateTimeDisplay(syncInfo.at),
            n: syncInfo.newCount ?? 0,
            total: syncInfo.total ?? 0,
          })}
        </p>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div className="statc-row">
          <div className="statc">
            <span className="statc__tile statc__tile--slate" aria-hidden="true">
              <Icon name="note" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('consultations.totalLabel')}</span>
              <span className="statc__value">{stats.total}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          {STATUSES.map((key) => (
            <div className="statc" key={key}>
              <span
                className={`statc__tile statc__tile--${STATUS_TILE[key].tile}`}
                aria-hidden="true"
              >
                <Icon name={STATUS_TILE[key].glyph} />
              </span>
              <span className="statc__text">
                <span className="statc__label">{t(`consultations.status.${key}`)}</span>
                <span className="statc__value">{stats.counts[key]}</span>
              </span>
              <span className="statc__chev" aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn--neutral filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="cs-filters"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        {t('common.filters')}
        <Icon name="chevronDown" aria-hidden="true" />
      </button>

      <div id="cs-filters" className="cl-toolbar cs-toolbar">
        <div className="field cl-toolbar__search">
          <label htmlFor="cs-search">{t('common.search')}</label>
          <input
            id="cs-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('consultations.searchPlaceholder')}
          />
        </div>
        <div className={`cl-toolbar__group${filtersOpen ? '' : ' is-collapsed'}`}>
          <div className="field cl-toolbar__filter">
            <label htmlFor="cs-status-filter">{t('common.status')}</label>
            <select
              id="cs-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value={ANY}>{t('consultations.allStatuses')}</option>
              {STATUSES.map((key) => (
                <option key={key} value={key}>
                  {t(`consultations.status.${key}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="field cl-toolbar__filter">
            <label htmlFor="cs-country">{t('consultations.colCountry')}</label>
            <select
              id="cs-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value={ANY}>{t('consultations.allCountries')}</option>
              {countryOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="field cl-toolbar__filter">
            <label htmlFor="cs-service">{t('consultations.colService')}</label>
            <select
              id="cs-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value={ANY}>{t('consultations.allServices')}</option>
              {serviceOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="btn btn--neutral btn--sm cl-toolbar__reset"
              onClick={clearFilters}
            >
              {t('clients.clearFilters')}
            </button>
          )}
        </div>

        {!loading && !loadError && rows.length > 0 && (
          <button type="button" className="btn btn--neutral btn--sm cs-export" onClick={exportCsv}>
            <Icon name="download" aria-hidden="true" />
            {t('consultations.exportCsv')}
          </button>
        )}
      </div>

      <p className="cl-summary">
        {loading
          ? t('common.loading')
          : `${visible.length} ${t('common.of')} ${rows.length}`}
      </p>

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('common.loading')}
          </div>
        </div>
      ) : loadError ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              <Icon name="x" />
            </div>
            <h3>{t('consultations.loadError')}</h3>
            <p>{loadError.message || t('consultations.loadError')}</p>
            <p className="cs-error-hint">{t('consultations.loadErrorHint')}</p>
            <button type="button" className="btn btn--primary" onClick={load}>
              {t('common.retry')}
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              <Icon name="note" />
            </div>
            <h3>{t('consultations.emptyTitle')}</h3>
            <p>{t('consultations.emptyBody')}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? t('consultations.syncing') : t('consultations.sync')}
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              <Icon name="search" />
            </div>
            <h3>{t('consultations.noMatchTitle')}</h3>
            <p>{t('consultations.noMatchBody')}</p>
            <button type="button" className="btn btn--neutral" onClick={clearFilters}>
              {t('clients.clearFilters')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>{t('consultations.colName')}</th>
                  <th>{t('consultations.colPhone')}</th>
                  <th>{t('consultations.colCountry')}</th>
                  <th>{t('consultations.colService')}</th>
                  <th>{t('consultations.colDate')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td data-label={t('consultations.colName')}>
                      <div className="cl-identity">
                        <span className="cl-avatar" aria-hidden="true">
                          {initialsOf(row.full_name)}
                        </span>
                        <span>
                          <span className="cl-name">{row.full_name || '—'}</span>
                          <span className="cl-sub">{row.email || '—'}</span>
                        </span>
                      </div>
                    </td>
                    <td data-label={t('consultations.colPhone')}>
                      <span className="cl-passport">{row.phone || '—'}</span>
                    </td>
                    <td data-label={t('consultations.colCountry')}>
                      <span className="cell-v">{row.country ? humanSlug(row.country) : '—'}</span>
                    </td>
                    <td data-label={t('consultations.colService')}>
                      <span className="cell-v">{row.service ? humanSlug(row.service) : '—'}</span>
                    </td>
                    <td data-label={t('consultations.colDate')}>
                      <span className="cell-v mono">{formatDateTimeDisplay(row.submitted_at)}</span>
                    </td>
                    <td data-label={t('common.status')}>
                      <span className={`cs-badge cs-badge--${row.status || 'new'}`}>
                        {t(`consultations.status.${row.status || 'new'}`)}
                      </span>
                    </td>
                    <td className="actions-cell" data-label={t('common.actions')}>
                      <div className="cl-actions">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => openDetail(row)}
                        >
                          {t('consultations.view')}
                        </button>
                        {row.phone && (
                          <a
                            className="btn btn--whatsapp btn--sm"
                            href={whatsappShareUrl(
                              row.phone,
                              t('consultations.waText', { name: row.full_name || '—' })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('invoice.whatsapp')}
                          </a>
                        )}
                        {row.email && (
                          <a
                            className="btn btn--neutral btn--sm"
                            href={`mailto:${row.email}`}
                          >
                            {t('consultations.email')}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <Modal
          title="consultations.detailTitle"
          onClose={closeDetail}
          className="cs-modal"
          actions={
            <>
              {detailWhatsUrl && (
                <a
                  className="btn btn--whatsapp"
                  href={detailWhatsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('invoice.whatsapp')}
                </a>
              )}
              {selected.email && (
                <a className="btn btn--neutral" href={`mailto:${selected.email}`}>
                  {t('consultations.email')}
                </a>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={saveDetail}
                disabled={saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <div className="cs-detail__meta">
            <span>
              <b>{t('consultations.detailForm')}</b> {selected.form_name || 'consultation'}
            </span>
            <span>
              <b>{t('consultations.detailSubmitted')}</b>{' '}
              {formatDateTimeDisplay(selected.submitted_at)}
            </span>
            <span>
              <b>{t('consultations.detailNetlifyId')}</b>{' '}
              <code className="cs-detail__id">{selected.netlify_id}</code>
            </span>
          </div>

          <h4 className="cs-detail__section">{t('consultations.fields')}</h4>
          {rawEntries.length === 0 ? (
            <p className="cs-detail__empty">—</p>
          ) : (
            <dl className="cs-detail__fields">
              {rawEntries.map(([key, value]) => (
                <div className="cs-detail__row" key={key}>
                  <dt>{prettyKey(key)}</dt>
                  <dd>{renderValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <h4 className="cs-detail__section">{t('consultations.manage')}</h4>
          <div className="cs-detail__manage">
            <div className="field">
              <label htmlFor="cs-detail-status">{t('common.status')}</label>
              <select
                id="cs-detail-status"
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {t(`consultations.status.${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cs-detail-notes">{t('consultations.notes')}</label>
              <textarea
                id="cs-detail-notes"
                rows={3}
                value={draft.notes}
                placeholder={t('consultations.notesPlaceholder')}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
