import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import {
  PAGE_PERMISSIONS,
  ACTION_PERMISSIONS,
  ROLE_OPTIONS,
  presetFor,
} from '../../auth/permissions.js';
import { formatDateShort } from '../../utils/formatDate.js';
import '../../styles/admin.css';

const EMPTY_FORM = {
  email: '',
  password: '',
  full_name: '',
  role: 'custom',
  permissions: [],
  is_active: true,
};

function permissionCount(row) {
  if (row.role === 'admin') return 'All';
  return Array.isArray(row.permissions) ? row.permissions.length : 0;
}

export default function AdminUsers() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();

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
      toast.error(`Could not load users: ${error.message}`);
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
      setFormError('Full name is required.');
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
      toast.success('User updated.');
      setFormOpen(false);
      await load();
      return;
    }

    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setFormError('A valid email is required.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
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
    toast.success('User created. Share the email and password with them.');
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
    toast.success(row.is_active === false ? 'User activated.' : 'User deactivated.');
    await load();
  };

  /* --------------------------------- password --------------------------------- */

  const handlePassword = async (event) => {
    event.preventDefault();
    if (!pwValue || pwValue.length < 8) {
      setPwError('Password must be at least 8 characters.');
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
    toast.success(`Password updated for ${pwTarget.email}.`);
    setPwTarget(null);
    setPwValue('');
  };

  /* ---------------------------------- delete ---------------------------------- */

  const performDelete = async () => {
    const { error } = await supabase.rpc('admin_delete_user', { p_id: deleteTarget.id });
    if (error) throw new Error(error.message);
    toast.success('User deleted.');
    await load();
  };

  /* ---------------------------------- render ---------------------------------- */

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card">
          <div className="card__body">
            <p>Only admins can manage users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="subtitle">
            Create accounts for employees and delegates, and turn any page or
            button on or off for each of them.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Add User
        </button>
      </div>

      <div className="card au-card">
        {loading ? (
          <div className="au-loading">
            <span className="spinner" aria-hidden="true" />
            <p>Loading users…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="au-empty">
            <p>No users yet. Create the first one.</p>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              + Add User
            </button>
          </div>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Permissions</th>
                <th>Created</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelf = row.id === user?.id;
                return (
                  <tr key={row.id} className={row.is_active === false ? 'au-row--off' : ''}>
                    <td>
                      <span className="au-name">{row.full_name || '—'}</span>
                      <span className="au-email">{row.email}</span>
                    </td>
                    <td>
                      <span className={`au-chip au-chip--${row.role}`}>{row.role}</span>
                    </td>
                    <td>
                      <span className={`au-status${row.is_active === false ? ' au-status--off' : ''}`}>
                        {row.is_active === false ? 'Deactivated' : 'Active'}
                      </span>
                    </td>
                    <td>{permissionCount(row)}</td>
                    <td className="au-date">{row.created_at ? formatDateShort(row.created_at) : '—'}</td>
                    <td className="au-actions">
                      {!isSelf && (
                        <button type="button" className="btn btn--neutral btn--sm" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--neutral btn--sm"
                        onClick={() => {
                          setPwTarget(row);
                          setPwValue('');
                          setPwError('');
                        }}
                      >
                        Password
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => toggleActive(row)}
                        >
                          {row.is_active === false ? 'Activate' : 'Deactivate'}
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => {
                            setDeleteTarget(row);
                            setAuthPrompt(false);
                          }}
                        >
                          Delete
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
          title={editing ? `Edit ${editing.email}` : 'Add user'}
          onClose={() => !busy && setFormOpen(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setFormOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" form="au-form" className="btn btn--primary" disabled={busy}>
                {busy ? <span className="btn__spinner" aria-hidden="true" /> : editing ? 'Save changes' : 'Create user'}
              </button>
            </>
          }
        >
          <form id="au-form" className="au-form" onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="au-name">Full name</label>
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
                  <label htmlFor="au-email">Email</label>
                  <input
                    id="au-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={busy}
                  />
                </div>
                <div className="field">
                  <label htmlFor="au-password">Password</label>
                  <input
                    id="au-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                  <span className="field__hint">Minimum 8 characters. Tell the user this password.</span>
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="au-role">Role</label>
              <select id="au-role" value={form.role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                Choosing a role fills the checklist below — you can still toggle anything.
              </span>
            </div>

            <fieldset className="au-perms" disabled={busy}>
              <legend>
                Permissions
                <span className="au-perms__count">{form.permissions.length} selected</span>
              </legend>

              <p className="au-perms__group">Pages</p>
              <div className="au-perms__grid">
                {PAGE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="au-check">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>

              <p className="au-perms__group">Buttons &amp; actions</p>
              <div className="au-perms__grid">
                {ACTION_PERMISSIONS.map((p) => (
                  <label key={p.key} className="au-check">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                    />
                    <span>{p.label}</span>
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
                <span>Account is active (can sign in)</span>
              </label>
            )}

            {formError && <span className="field__error">{formError}</span>}
          </form>
        </Modal>
      )}

      {/* ------------------------------ password modal ------------------------------ */}
      {pwTarget && (
        <Modal
          title={`Set password — ${pwTarget.email}`}
          onClose={() => !pwBusy && setPwTarget(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setPwTarget(null)}
                disabled={pwBusy}
              >
                Cancel
              </button>
              <button type="submit" form="au-pw-form" className="btn btn--primary" disabled={pwBusy}>
                {pwBusy ? <span className="btn__spinner" aria-hidden="true" /> : 'Set password'}
              </button>
            </>
          }
        >
          <form id="au-pw-form" className="au-form" onSubmit={handlePassword}>
            <div className="field">
              <label htmlFor="au-pw">New password</label>
              <input
                id="au-pw"
                type="password"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                autoComplete="new-password"
                autoFocus
                disabled={pwBusy}
              />
              <span className="field__hint">Minimum 8 characters. The user will be signed out everywhere.</span>
            </div>
            {pwError && <span className="field__error">{pwError}</span>}
          </form>
        </Modal>
      )}

      {/* -------------------------------- delete flow -------------------------------- */}
      {deleteTarget && !authPrompt && (
        <Modal
          title="Delete user?"
          danger
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                Delete User
              </button>
            </>
          }
        >
          <p>
            This permanently deletes <strong>{deleteTarget.email}</strong> and everything they
            created (their invoices, clients, documents and stored PDFs). This cannot be undone.
          </p>
        </Modal>
      )}

      {deleteTarget && authPrompt && (
        <ConfirmAuthModal
          title="Confirm your identity"
          reason={`Enter your account credentials to permanently delete ${deleteTarget.email} and all of their data.`}
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
