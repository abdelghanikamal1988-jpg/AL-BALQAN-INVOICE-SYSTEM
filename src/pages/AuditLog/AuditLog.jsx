import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icons/Icon.jsx';
import SkeletonRows from '../../components/Skeleton/SkeletonRows.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  dbFetchAuditLog,
  dbCountAuditLog,
  dbFetchAuditUsers,
} from '../../lib/auditRepo.js';
import '../../styles/admin.css';

const TABLES = ['', 'invoices', 'clients', 'consultation_requests', 'invoice_payments'];
const ACTIONS = ['', 'INSERT', 'UPDATE', 'DELETE'];
const PAGE = 50;

export default function AuditLog() {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [userNames, setUserNames] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        dbFetchAuditLog({ limit: shown, table, action }),
        dbCountAuditLog({ table, action }),
      ]);
      setRows(list);
      setTotal(count);
      const names = await dbFetchAuditUsers(list.map((r) => r.user_id));
      setUserNames(names);
    } catch {
      toast.error(t('audit.loadError'));
    } finally {
      setLoading(false);
    }
  }, [shown, table, action, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const counts = { INSERT: 0, UPDATE: 0, DELETE: 0 };
    for (const r of rows) counts[r.action] = (counts[r.action] || 0) + 1;
    return counts;
  }, [rows]);

  return (
    <div className="page audit-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t('audit.eyebrow')}</p>
          <h1>{t('audit.title')}</h1>
          <p className="subtitle">{t('audit.subtitle')}</p>
        </div>
      </div>

      <section className="card" aria-label={t('audit.title')}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="note" /></span>
          <h2>{t('audit.logTitle')}</h2>
        </div>
        <div className="card__body">
          <div className="audit-filters">
            <div className="field">
              <label htmlFor="audit-table">{t('audit.filterTable')}</label>
              <select id="audit-table" value={table} onChange={(e) => { setTable(e.target.value); setShown(PAGE); }}>
                {TABLES.map((v) => (
                  <option key={v} value={v}>{v ? t(`audit.table.${v}`) : t('audit.allTables')}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="audit-action">{t('audit.filterAction')}</label>
              <select id="audit-action" value={action} onChange={(e) => { setAction(e.target.value); setShown(PAGE); }}>
                {ACTIONS.map((v) => (
                  <option key={v} value={v}>{v ? t(`audit.action.${v}`) : t('audit.allActions')}</option>
                ))}
              </select>
            </div>
            <p className="audit-summary">
              {t('audit.summary', {
                total,
                inserts: summary.INSERT,
                updates: summary.UPDATE,
                deletes: summary.DELETE,
              })}
            </p>
          </div>

          {loading ? (
            <SkeletonRows rows={8} cols={5} />
          ) : rows.length === 0 ? (
            <p className="audit-empty">{t('audit.empty')}</p>
          ) : (
            <div className="table-wrap">
              <table className="cl-table">
                <thead>
                  <tr>
                    <th>{t('audit.colTime')}</th>
                    <th>{t('audit.colUser')}</th>
                    <th>{t('audit.colTable')}</th>
                    <th>{t('audit.colAction')}</th>
                    <th>{t('audit.colFields')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>{userNames[row.user_id] || t('audit.system')}</td>
                      <td>{t(`audit.table.${row.table_name}`)}</td>
                      <td>
                        <span className={`audit-action audit-action--${row.action.toLowerCase()}`}>
                          {t(`audit.action.${row.action}`)}
                        </span>
                      </td>
                      <td>{row.changed_keys?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length < total && (
            <div className="load-more">
              <button type="button" className="btn btn--neutral" onClick={() => setShown((n) => n + PAGE)}>
                {t('common.loadMore')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
