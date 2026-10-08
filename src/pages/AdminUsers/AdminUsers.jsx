import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Icon from '../../components/Icons/Icon.jsx';
import {
  PAGE_PERMISSIONS,
  ACTION_PERMISSIONS,
  ROLE_OPTIONS,
  presetFor,
} from '../../auth/permissions.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { useLang } from '../../context/LangContext.jsx';
import '../../styles/admin.css';

const EMPTY_FORM = {
  email: '',
  password: '',
  full_name: '',
  role: 'custom',
  permissions: [],
  is_active: true,
};

function permissionCount(row, t) {
  if (row.role === 'admin') return t('common.all');
  return Array.isArray(row.permissions) ? row.permissions.length : 0;
}

export default function AdminUsers() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const { t } = useLang();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // create / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // password modal
  const [pwTarget, setPwTarget] = useState(null);
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // delete flow
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [authPrompt, setAuthPrompt] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, permissions, is_active, created_at')
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(t('admin.toast.loadError', { msg: error.message }));
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /* ------------------------------ create / edit ------------------------------ */

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      email: row.email || '',
      password: '',
      full_name: row.full_name || '',
      role: row.role || 'custom',
      permissions: Array.isArray(row.permissions) ? [...row.permissions] : [],
      is_active: row.is_active !== false,
    });
    setFormError('');
    setFormOpen(true);
  };

  const setRole = (role) => {
    setForm((prev) => ({ ...prev, role, permissions: presetFor(role) }));
  };

  const togglePerm = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!form.full_name.trim()) {
      setFormError(t('admin.err.fullNameRequired'));
      return;
    }

    if (editing) {
      setBusy(true);
      const { error } = await supabase.rpc('admin_update_user', {
        p_id: editing.id,
        p_full_name: form.full_name.trim(),
        p_role: form.role,
        p_permissions: form.permissions,
        p_is_active: form.is_active,
      });
      setBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
      toast.success(t('admin.toast.updated'));
      setFormOpen(false);
      await load();
      return;
    }

    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setFormError(t('admin.err.emailInvalid'));
      return;
    }
    if (!form.password || form.password.length < 8) {
      setFormError(t('admin.err.passwordShort'));
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc('admin_create_user', {
      p_email: email,
      p_password: form.password,
      p_full_name: form.full_name.trim(),
      p_role: form.role,
      p_permissions: form.permissions,
    });
    setBusy(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    toast.success(t('admin.toast.created'));
    setFormOpen(false);
    await load();
  };

  /* -------------------------------- deactivate -------------------------------- */

  const toggleActive = async (row) => {
    const { error } = await supabase.rpc('admin_update_user', {
      p_id: row.id,
      p_is_active: row.is_active === false,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      row.is_active === false ? t('admin.toast.activated') : t('admin.toast.deactivated'),
    );
    await load();
  };

  /* --------------------------------- password --------------------------------- */

  const handlePassword = async (event) => {
    event.preventDefault();
    if (!pwValue || pwValue.length < 8) {
      setPwError(t('admin.err.passwordShort'));
      return;
    }
    setPwBusy(true);
    setPwError('');
    const { error } = await supabase.rpc('admin_set_password', {
      p_id: pwTarget.id,
      p_password: pwValue,
    });
    setPwBusy(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    toast.success(t('admin.toast.passwordUpdated', { email: pwTarget.email }));
    setPwTarget(null);
    setPwValue('');
  };

  /* ---------------------------------- delete ---------------------------------- */

  const performDelete = async () => {
    const { error } = await supabase.rpc('admin_delete_user', { p_id: deleteTarget.id });
    if (error) throw new Error(error.message);
    toast.success(t('admin.toast.deleted'));
    await load();
  };

  /* ---------------------------------- render ---------------------------------- */

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card">
          <div className="card__body">
            <p>{t('admin.noAccess')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.title')}</h1>
          <p className="subtitle">{t('admin.subtitle')}</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">{t('admin.home')}</Link>
            </li>
            <li>
              <span className="crumbs__cur">{t('admin.title')}</span>
            </li>
          </ul>
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" aria-hidden="true" />
            {t('admin.addUser')}
          </button>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="statc-row">
          <div className="statc">
            <span className="statc__tile statc__tile--slate" aria-hidden="true">
              <Icon name="users" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('admin.stat.accounts')}</span>
              <span className="statc__value">{rows.length}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          <div className="statc">
            <span className="statc__tile statc__tile--green" aria-hidden="true">
              <Icon name="userCheck" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('admin.stat.active')}</span>
              <span className="statc__value">
                {rows.filter((r) => r.is_active !== false).length}
              </span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          <div className="statc">
            <span className="statc__tile statc__tile--amber" aria-hidden="true">
              <Icon name="lock" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('admin.stat.administrators')}</span>
              <span className="statc__value">{rows.filter((r) => r.role === 'admin').length}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
        </div>
      )}

      <div className="card au-card">
        {loading ? (
          <div className="au-loading">
            <span className="spinner" aria-hidden="true" />
            <p>{t('admin.loading')}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="au-empty">
            <p>{t('admin.empty')}</p>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              + {t('admin.addUser')}
            </button>
          </div>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>{t('admin.col.user')}</th>
                <th>{t('admin.col.role')}</th>
                <th>{t('common.status')}</th>
                <th>{t('admin.col.permissions')}</th>
                <th>{t('admin.col.created')}</th>
                <th aria-label={t('common.actions')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelf = row.id === user?.id;
                return (
                  <tr key={row.id} className={row.is_active === false ? 'au-row--off' : ''}>
                  <td data-label={t('admin.col.user')}>
                    <span className="au-name">{row.full_name || '—'}</span>
                    <span className="au-email">{row.email}</span>
                  </td>
                  <td data-label={t('admin.col.role')}>
                    <span className={`au-chip au-chip--${row.role}`}>
                      {t(`admin.role.${row.role}`)}
                    </span>
                  </td>
                  <td data-label={t('common.status')}>
                    <span className={`au-status${row.is_active === false ? ' au-status--off' : ''}`}>
                      {row.is_active === false ? t('admin.status.disabled') : t('admin.status.active')}
                    </span>
                  </td>
                  <td data-label={t('admin.col.permissions')}>{permissionCount(row, t)}</td>
                  <td className="au-date" data-label={t('admin.col.created')}>{row.created_at ? formatDateShort(row.created_at) : '—'}</td>
                  <td className="au-actions" data-label={t('common.actions')}>
                      {!isSelf && (
                        <button
                          type="button"
                          className="icon-btn"
                          title={t('admin.action.edit')}
                          aria-label={t('admin.a11y.edit', { email: row.email })}
                          onClick={() => openEdit(row)}
                        >
                          <Icon name="pencil" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        title={t('admin.action.setPassword')}
                        aria-label={t('admin.a11y.setPassword', { email: row.email })}
                        onClick={() => {
                          setPwTarget(row);
                          setPwValue('');
                          setPwError('');
                        }}
                      >
                        <Icon name="key" />
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className="icon-btn"
                          title={
                            row.is_active === false
                              ? t('admin.action.activate')
                              : t('admin.action.deactivate')
                          }
                          aria-label={
                            row.is_active === false
                              ? t('admin.a11y.activate', { email: row.email })
                              : t('admin.a11y.deactivate', { email: row.email })
                          }
                          onClick={() => toggleActive(row)}
                        >
                          <Icon name="userCheck" />
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          title={t('admin.action.delete')}
                          aria-label={t('admin.a11y.delete', { email: row.email })}
                          onClick={() => {
                            setDeleteTarget(row);
                            setAuthPrompt(false);
                          }}
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --------------------------- create / edit modal --------------------------- */}
      {formOpen && (
        <Modal
          className="au-modal"
          title={editing ? t('admin.modal.edit', { email: editing.email }) : t('admin.modal.add')}
          onClose={() => !busy && setFormOpen(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setFormOpen(false)}
                disabled={busy}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" form="au-form" className="btn btn--primary" disabled={busy}>
                {busy ? (
                  <span className="btn__spinner" aria-hidden="true" />
                ) : editing ? (
                  t('admin.modal.saveChanges')
                ) : (
                  t('admin.modal.createUser')
                )}
              </button>
            </>
          }
        >
          <form id="au-form" className="au-form" onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="au-name">{t('admin.form.fullName')}</label>
              <input
                id="au-name"
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                autoFocus
                disabled={busy}
              />
            </div>

            {!editing && (
              <>
                <div className="field">
                  <label htmlFor="au-email">{t('admin.form.email')}</label>
                  <input
                    id="au-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={busy}
                  />
                </div>
                <div className="field">
                  <label htmlFor="au-password">{t('admin.form.password')}</label>
                  <input
                    id="au-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                  <span className="field__hint">{t('admin.form.passwordHint')}</span>
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="au-role">{t('admin.form.role')}</label>
              <select id="au-role" value={form.role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`admin.role.${opt.value}`)}
                  </option>
                ))}
              </select>
              <span className="field__hint">{t('admin.form.roleHint')}</span>
            </div>

            <fieldset className="au-perms" disabled={busy}>
              <legend>
                {t('admin.permGroup.title')}
                <span className="au-perms__count">
                  {t('admin.permGroup.selected', { count: form.permissions.length })}
                </span>
              </legend>

              <p className="au-perms__group">{t('admin.permGroup.pages')}</p>
              <div className="au-perms__grid">
                {PAGE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="au-check">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                    />
                    <span>{t(`admin.perm.${p.key}`)}</span>
                  </label>
                ))}
              </div>

              <p className="au-perms__group">{t('admin.permGroup.actions')}</p>
              <div className="au-perms__grid">
                {ACTION_PERMISSIONS.map((p) => (
                  <label key={p.key} className="au-check">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                    />
                    <span>{t(`admin.perm.${p.key}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {editing && (
              <label className="au-check au-check--row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span>{t('admin.form.accountActive')}</span>
              </label>
            )}

            {formError && <span className="field__error">{formError}</span>}
          </form>
        </Modal>
      )}

      {/* ------------------------------ password modal ------------------------------ */}
      {pwTarget && (
        <Modal
          title={t('admin.modal.setPassword', { email: pwTarget.email })}
          onClose={() => !pwBusy && setPwTarget(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setPwTarget(null)}
                disabled={pwBusy}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" form="au-pw-form" className="btn btn--primary" disabled={pwBusy}>
                {pwBusy ? <span className="btn__spinner" aria-hidden="true" /> : t('admin.modal.setPasswordBtn')}
              </button>
            </>
          }
        >
          <form id="au-pw-form" className="au-form" onSubmit={handlePassword}>
            <div className="field">
              <label htmlFor="au-pw">{t('admin.form.newPassword')}</label>
              <input
                id="au-pw"
                type="password"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                autoComplete="new-password"
                autoFocus
                disabled={pwBusy}
              />
              <span className="field__hint">{t('admin.form.passwordHint2')}</span>
            </div>
            {pwError && <span className="field__error">{pwError}</span>}
          </form>
        </Modal>
      )}

      {/* -------------------------------- delete flow -------------------------------- */}
      {deleteTarget && !authPrompt && (
        <Modal
          title={t('admin.delete.title')}
          danger
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                {t('admin.delete.confirmBtn')}
              </button>
            </>
          }
        >
          <p>
            {t('admin.delete.bodyPre')} <strong>{deleteTarget.email}</strong>{' '}
            {t('admin.delete.bodyPost')}
          </p>
        </Modal>
      )}

      {deleteTarget && authPrompt && (
        <ConfirmAuthModal
          title={t('admin.delete.identityTitle')}
          reason={t('admin.delete.reason', { email: deleteTarget.email })}
          onCancel={() => setAuthPrompt(false)}
          onConfirm={performDelete}
          onSuccess={() => {
            setDeleteTarget(null);
            setAuthPrompt(false);
          }}
        />
      )}
    </div>
  );
}
