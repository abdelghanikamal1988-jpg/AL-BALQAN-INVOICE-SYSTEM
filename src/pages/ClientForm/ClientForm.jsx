import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Can from '../../components/Can/Can.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  dbFetchAgents,
  dbInsertAgent,
  dbFetchClient,
  dbInsertClient,
  dbUpdateClient,
} from '../../lib/clientRepo.js';
import { dbSubmitPending } from '../../lib/pendingRepo.js';
import {
  emptyClientForm,
  clientToForm,
  formToClient,
  validateClientForm,
  newClientId,
} from '../../utils/clients.js';
import { filterTextInput } from '../../utils/textCase.js';
import { nextFileNumber } from '../../utils/fileNumber.js';
import { CLIENT_DESTINATIONS, CLIENT_SERVICES } from '../../data/clientOptions.js';
import {
  DOCUMENT_TYPES,
  DOCUMENT_ACCEPT,
  OTHER_DOCUMENT_ACCEPT,
  MAX_UPLOAD_BYTES,
  normalizeDocuments,
  uploadClientDocument,
  removeClientDocument,
  documentUrl,
  currentUserId,
} from '../../utils/uploads.js';
import '../../styles/clients.css';

const ADD_AGENT = '__add__';
const CUSTOMER = 'CUSTOMER';

const FIELD_GROUPS = [
  {
    id: 'personal',
    icon: 'user',
    title: 'clients.groupPersonal',
    note: 'clients.groupPersonalNote',
    fields: [
      { key: 'firstName', label: 'clients.field.name', type: 'text' },
      { key: 'fatherName', label: 'clients.field.fatherName', type: 'text' },
      { key: 'surname', label: 'clients.field.surname', type: 'text' },
      { key: 'sex', label: 'clients.field.sex', type: 'select', options: ['Male', 'Female'] },
      { key: 'dateOfBirth', label: 'clients.field.dateOfBirth', type: 'date' },
      { key: 'placeOfBirth', label: 'clients.field.placeOfBirth', type: 'text' },
    ],
  },
  {
    id: 'passport',
    icon: 'folder',
    title: 'clients.groupPassport',
    note: 'clients.groupPassportNote',
    fields: [
      { key: 'passport', label: 'clients.field.passport', type: 'text' },
      { key: 'country', label: 'clients.field.country', type: 'text' },
      { key: 'dateOfIssue', label: 'clients.field.dateOfIssue', type: 'date' },
      { key: 'dateOfExpiry', label: 'clients.field.dateOfExpiry', type: 'date' },
      { key: 'issuingPlace', label: 'clients.field.issuingPlace', type: 'text' },
    ],
  },
  {
    id: 'travel',
    icon: 'plane',
    title: 'clients.groupTravel',
    note: 'clients.groupTravelNote',
    fields: [
      { key: 'destination', label: 'clients.field.destination', type: 'select', options: CLIENT_DESTINATIONS },
      { key: 'service', label: 'clients.field.service', type: 'select', options: CLIENT_SERVICES },
    ],
  },
  {
    id: 'referral',
    icon: 'userCheck',
    title: 'clients.groupReferral',
    note: 'clients.groupReferralNote',
    fields: [
      { key: 'referralAgent', label: 'clients.field.referralAgent', type: 'agent' },
    ],
  },
];

export default function ClientForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { t } = useLang();
  const toast = useToast();
  const { hasPerm, needsEditApproval, profile } = useAuth();
  const canSave = hasPerm('action:client.save');
  /* An agent's own clients are never referred by someone else, so the
     referral picker is hidden and the referral agent is always the agent's
     own name (the same name the admin and employees see in the list). */
  const isAgent = profile?.role === 'delegate';
  const agentOwnName = useMemo(
    () =>
      String(profile?.full_name || (profile?.email ? profile.email.split('@')[0] : '') || '')
        .replace(/\s+/g, ' ')
        .trim(),
    [profile]
  );
  const nameRef = useRef(null);

  const [form, setForm] = useState(emptyClientForm());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  const [agents, setAgents] = useState([]);
  const [agentChoice, setAgentChoice] = useState('');
  const [addingAgent, setAddingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  const [docs, setDocs] = useState({});
  const [pending, setPending] = useState({});
  const [previews, setPreviews] = useState({});
  const [stalePaths, setStalePaths] = useState([]);

  const [confirmDocs, setConfirmDocs] = useState(false);

  /* ------------------------------ load ------------------------------ */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const agentList = await dbFetchAgents().catch((err) => {
          console.warn('referral_agents unavailable — run supabase/clients.sql', err);
          return [];
        });
        if (!active) return;
        setAgents(agentList);

        if (editing && id) {
          const client = await dbFetchClient(id);
          if (!active) return;
          if (!client) {
            toast.error(t('clients.toastNotFound'));
            navigate('/clients', { replace: true });
            return;
          }
          setExisting(client);
          setForm(clientToForm(client));
          setDocs(normalizeDocuments(client.documents || {}));
          setAgentChoice(client.referralAgent || CUSTOMER);
          setForm((prev) => ({ ...prev, referralAgentId: client.referralAgentId || null }));
        } else {
          setAgentChoice(CUSTOMER);
          requestAnimationFrame(() => nameRef.current?.focus());
        }
      } catch (err) {
        console.error(err);
        if (active) {
          toast.error(t('clients.toastLoadFormError'));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing]);

  /* --------------------- previews for stored files --------------------- */
  useEffect(() => {
    let active = true;
    const urls = {};
    (async () => {
      for (const def of DOCUMENT_TYPES) {
        if (def.multiple) {
          const list = docs[def.id] || [];
          const resolved = await Promise.all(
            list.map((meta) =>
              meta && meta.path
                ? documentUrl(meta.path).catch(() => null)
                : Promise.resolve(null)
            )
          );
          urls[def.id] = resolved;
        } else {
          const meta = docs[def.id];
          if (meta && meta.path) {
            try {
              urls[def.id] = await documentUrl(meta.path);
            } catch (err) {
              urls[def.id] = null;
            }
          }
        }
      }
      if (active) setPreviews((prev) => ({ ...prev, ...urls }));
    })();
    return () => {
      active = false;
    };
  }, [docs]);

  const previewsRef = useRef({});
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  /* ------------------------------ agents ------------------------------ */
  const agentOptions = useMemo(() => {
    const names = agents.map((a) => a.name).filter((n) => n !== CUSTOMER);
    const options = [CUSTOMER, ...names];
    if (agentChoice && !options.includes(agentChoice)) options.unshift(agentChoice);
    return options;
  }, [agents, agentChoice]);

  const handleAgentChange = (value) => {
    if (value === ADD_AGENT) {
      setAddingAgent(true);
      setNewAgentName('');
      return;
    }
    setAddingAgent(false);
    setAgentChoice(value);
    const match = agents.find((a) => a.name === value);
    setForm((prev) => ({ ...prev, referralAgent: value, referralAgentId: match ? match.id : null }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.referralAgent;
      return next;
    });
  };

  const saveNewAgent = async () => {
    const name = newAgentName.trim();
    if (!name) {
      toast.error(t('clients.toastAgentName'));
      return;
    }
    try {
      const row = await dbInsertAgent(name);
      setAgents((prev) => [...prev, row]);
      setAgentChoice(row.name);
      setForm((prev) => ({ ...prev, referralAgent: row.name, referralAgentId: row.id || null }));
      setAddingAgent(false);
      setNewAgentName('');
      toast.success(t('clients.toastAgentAdded'));
    } catch (err) {
      toast.error(err.message || t('clients.toastAgentError'));
    }
  };

  /* ---------------------------- documents ---------------------------- */
  const handleFile = (docId, file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('clients.toastFileTooBig'));
      return;
    }
    const previous = docs[docId];
    if (previous && previous.path) setStalePaths((prev) => [...prev, previous.path]);
    setPending((prev) => ({ ...prev, [docId]: file }));
    setPreviews((prev) => {
      const old = prev[docId];
      if (typeof old === 'string' && old.startsWith('blob:')) URL.revokeObjectURL(old);
      return { ...prev, [docId]: URL.createObjectURL(file) };
    });
    setDocs((prev) => ({
      ...prev,
      [docId]: { name: file.name, size: file.size, type: file.type },
    }));
  };

  const handleRemoveDoc = (docId) => {
    const meta = docs[docId];
    if (meta && meta.path) setStalePaths((prev) => [...prev, meta.path]);
    setPending((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setPreviews((prev) => {
      const old = prev[docId];
      if (typeof old === 'string' && old.startsWith('blob:')) URL.revokeObjectURL(old);
      return { ...prev, [docId]: null };
    });
    setDocs((prev) => ({ ...prev, [docId]: null }));
  };

  /* The "other" slot accepts any number of PDFs; each keeps a stable key so
     a later remove targets exactly one file. */
  const handleOtherFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const entries = [];
    files.forEach((file) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(t('clients.toastFileTooBig'));
        return;
      }
      const key = `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      entries.push({ key, file, name: file.name, size: file.size, type: file.type });
    });
    if (!entries.length) return;
    setPending((prev) => ({
      ...prev,
      other: [...(prev.other || []), ...entries.map(({ key, file }) => ({ key, file }))],
    }));
    setDocs((prev) => ({
      ...prev,
      other: [...(prev.other || []), ...entries.map(({ key, name, size, type }) => ({ key, name, size, type }))],
    }));
  };

  const handleRemoveOther = (docId, index) => {
    const list = docs[docId] || [];
    const meta = list[index];
    if (meta && meta.path) setStalePaths((prev) => [...prev, meta.path]);
    setPending((prev) => {
      const nextList = (prev.other || []).filter((entry) => entry.key !== meta?.key);
      return { ...prev, other: nextList };
    });
    setDocs((prev) => ({
      ...prev,
      [docId]: (prev[docId] || []).filter((_, i) => i !== index),
    }));
  };

  /* "other" is an add-on slot, so only the passport and the photo warn. */
  const missingDocs = DOCUMENT_TYPES.filter((def) => !def.multiple && !docs[def.id]);
  const agentValue = isAgent
    ? agentOwnName || CUSTOMER
    : addingAgent
      ? newAgentName.trim()
      : agentChoice;

  /* ------------------------------- save ------------------------------- */
  const performSave = async () => {
    /* Admin approval workflow: a non-admin's EDIT is stored as a proposal,
       so the record (and its files) stay exactly as they are until an
       admin approves. New uploads already land in storage and are picked
       up by the proposal payload. */
    const pendingApproval = editing && needsEditApproval;

    setSaving(true);
    try {
      const userId = await currentUserId();
      const clientId = editing ? id : newClientId();
      const nextDocs = { ...docs };

      await Promise.all(
        Object.entries(pending).map(async ([docId, value]) => {
          if (docId === 'other') {
            const list = nextDocs.other || [];
            const uploaded = await Promise.all(
              (value || []).map(async ({ key, file }) => {
                const meta = await uploadClientDocument(userId, clientId, 'other', file, key);
                return meta;
              })
            );
            const byKey = new Map(uploaded.map((meta) => [meta.key, meta]));
            nextDocs.other = list.map((meta) => byKey.get(meta.key) || meta);
            return;
          }
          const uploaded = await uploadClientDocument(userId, clientId, docId, value);
          nextDocs[docId] = uploaded;
        })
      );

      if (nextDocs.other && nextDocs.other.length === 0) delete nextDocs.other;

      if (!pendingApproval) {
        await Promise.all(stalePaths.map((path) => removeClientDocument(path).catch(() => {})));
      }

      let resolvedAgent = agentValue;
      let resolvedAgentId = form.referralAgentId || null;
      const rememberAgent = (row) => {
        if (!row || !row.name) return;
        setAgents((prev) =>
          prev.some((a) => (row.id && a.id === row.id) || a.name === row.name)
            ? prev
            : [...prev, row]
        );
      };

      if (addingAgent && resolvedAgent) {
        try {
          const row = await dbInsertAgent(resolvedAgent);
          resolvedAgent = row.name || resolvedAgent;
          resolvedAgentId = row.id || resolvedAgentId;
          rememberAgent(row);
          setAgentChoice(resolvedAgent);
          setAddingAgent(false);
          setNewAgentName('');
        } catch (err) {
          console.warn('Agent kept on the client only:', err);
        }
      }

      /* An agent account files its own clients under its own name. The name
         is registered as a referral agent once, so the admin and employees
         can pick the same agent from the list when they create invoices. */
      if (isAgent && resolvedAgent) {
        const known = agents.find(
          (a) => a.name.toLowerCase() === resolvedAgent.toLowerCase()
        );
        if (known) {
          resolvedAgentId = known.id || resolvedAgentId;
        } else {
          try {
            const row = await dbInsertAgent(resolvedAgent);
            resolvedAgentId = row.id || resolvedAgentId;
            rememberAgent(row);
          } catch (err) {
            console.warn('Agent record not created:', err);
          }
        }
      }

      /* A file number is permanent: keep the one the client already has and
         hand a new client its first number as it is saved, so every client
         can be filed against the invoice that carries the same number. */
      let fileNo = existing?.fileNo || '';
      if (!fileNo) fileNo = await nextFileNumber();

      const client = formToClient(
        {
          ...form,
          referralAgent: resolvedAgent,
          referralAgentId: resolvedAgentId,
        },
        {
          id: clientId,
          documents: nextDocs,
          pdfPath: existing?.pdfPath || null,
          fileNo,
        }
      );

      if (editing) {
        if (pendingApproval) {
          await dbSubmitPending('client', client.id, client);
          toast.success(t('clients.toastPendingSubmit'));
          navigate(`/clients/${clientId}`);
        } else {
          await dbUpdateClient(client);
          toast.success(t('clients.toastUpdated'));
          navigate(`/clients/${clientId}`);
        }
      } else {
        await dbInsertClient(client);
        toast.success(t('clients.toastSaved'));
        navigate(`/clients/${clientId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || t('clients.toastSaveError'));
    } finally {
      setSaving(false);
      setConfirmDocs(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateClientForm({ ...form, referralAgent: agentValue });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t('clients.toastFixFields'));
      return;
    }
    if (missingDocs.length > 0) {
      setConfirmDocs(true);
      return;
    }
    await performSave();
  };

  if (loading) {
    return (
      <div className="page page--wide clients-page">
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('clients.loadingClient')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide clients-page">
      <div className="page-header">
        <div>
          <h1>{editing ? t('clients.editClient') : t('clients.newClient')}</h1>
          <p className="subtitle">
            {editing ? t('clients.editSubtitle') : t('clients.newSubtitle')}
            {editing && existing?.fileNo ? (
              <>
                {' · '}
                <span className="mono">
                  {t('clients.fileNo')}: {existing.fileNo}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="btn btn--neutral"
            onClick={() => navigate(editing ? `/clients/${id}` : '/clients')}
          >
            {t('common.cancel')}
          </button>
          <Can perm="action:client.save">
            <button
              type="submit"
              form="client-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? (
                <span className="btn__spinner" aria-hidden="true" />
              ) : (
                t(editing ? 'clients.updateClient' : 'clients.saveClient')
              )}
            </button>
          </Can>
        </div>
      </div>

      <form id="client-form" className="editor-layout" onSubmit={handleSubmit}>
        <div className="editor-form">
          {FIELD_GROUPS.filter((group) => !(isAgent && group.id === 'referral')).map((group) => (
            <section className="card" aria-label={t(group.title)} key={group.id}>
              <div className="card__header">
                <span className="card__icon" aria-hidden="true"><Icon name={group.icon} /></span>
                <h2>{t(group.title)}</h2>
              </div>
              <div className="card__body">
                <p className="cf-section__note">{t(group.note)}</p>
                <div className="cf-grid">
                  {group.fields.map((field) => {
                  const error = errors[field.key];
                  const wrapperClass = `field${error ? ' field--error' : ''}`;

                  if (field.type === 'agent') {
                    return (
                      <div className={wrapperClass} key={field.key}>
                        <label htmlFor="client-agent">
                          {t(field.label)}<span className="cf-req">*</span>
                        </label>
                        <select
                          id="client-agent"
                          value={addingAgent ? ADD_AGENT : agentChoice}
                          onChange={(e) => handleAgentChange(e.target.value)}
                        >
                          {agentOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          {canSave && (
                            <option value={ADD_AGENT}>{t('clients.addAgentOption')}</option>
                          )}
                        </select>
                        {canSave && addingAgent && (
                          <div className="cf-agent-add">
                            <input
                              type="text"
                              value={newAgentName}
                              placeholder={t('clients.agentNamePlaceholder')}
                              onChange={(e) => setNewAgentName(filterTextInput(e.target.value))}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={saveNewAgent}
                            >
                              {t('clients.add')}
                            </button>
                            <button
                              type="button"
                              className="btn btn--neutral btn--sm"
                              onClick={() => setAddingAgent(false)}
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        )}
                        {error && <span className="field__error">{t(error)}</span>}
                      </div>
                    );
                  }

                  if (field.type === 'select') {
                    return (
                      <div className={wrapperClass} key={field.key}>
                        <label htmlFor={`client-${field.key}`}>{t(field.label)}<span className="cf-req">*</span></label>
                        <select
                          id={`client-${field.key}`}
                          value={form[field.key]}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, [field.key]: e.target.value }));
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next[field.key];
                              return next;
                            });
                          }}
                        >
                          <option value="">{t('clients.selectPlaceholder')}</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {t(`clients.opt.${field.key}.${opt}`)}
                            </option>
                          ))}
                        </select>
                        {error && <span className="field__error">{t(error)}</span>}
                      </div>
                    );
                  }

                  return (
                    <div className={wrapperClass} key={field.key}>
                      <label htmlFor={`client-${field.key}`}>{t(field.label)}<span className="cf-req">*</span></label>
                      <input
                        id={`client-${field.key}`}
                        ref={field.key === 'firstName' ? nameRef : undefined}
                        type={field.type}
                        value={form[field.key]}
                        onChange={(e) => {
                          const value =
                            field.type === 'text' ? filterTextInput(e.target.value) : e.target.value;
                          setForm((prev) => ({ ...prev, [field.key]: value }));
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next[field.key];
                            return next;
                          });
                        }}
                      />
                      {error && <span className="field__error">{t(error)}</span>}
                    </div>
                  );
                  })}
                </div>
              </div>
            </section>
          ))}

          <section className="card" aria-label={t('clients.documents')}>
            <div className="card__header">
              <span className="card__icon" aria-hidden="true"><Icon name="paperclip" /></span>
              <h2>{t('clients.documents')}</h2>
            </div>
            <div className="card__body">
              <div className="cf-docs">
                {DOCUMENT_TYPES.filter((def) => !def.multiple).map((def) => {
                  const meta = docs[def.id];
                  const preview = previews[def.id];
                  const defLabel = t(`clients.doc.${def.id}`);
                  return (
                    <div className="cf-doc" key={def.id}>
                      <div className="cf-doc__label">{defLabel}</div>
                      {preview ? (
                        meta && meta.type === 'application/pdf' ? (
                          <div className="cf-doc__thumb">{t('clients.pdfDocument')}</div>
                        ) : (
                          <img className="cf-doc__thumb" src={preview} alt={defLabel} loading="lazy" decoding="async" />
                        )
                      ) : (
                        <div className="cf-doc__thumb">{t('clients.noFile')}</div>
                      )}
                      {meta && <div className="cf-doc__file">{meta.name}</div>}
                      <div className="cf-doc__btns">
                        <Can perm="action:client.upload">
                          <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                            {meta ? t('clients.replace') : t('common.upload')}
                            <input
                              type="file"
                              accept={DOCUMENT_ACCEPT}
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFile(def.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </Can>
                        <Can perm="action:client.upload">
                          {meta && (
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={() => handleRemoveDoc(def.id)}
                            >
                              {t('clients.remove')}
                            </button>
                          )}
                        </Can>
                      </div>
                    </div>
                  );
                })}

                {DOCUMENT_TYPES.filter((def) => def.multiple).map((def) => {
                  const list = docs[def.id] || [];
                  const defLabel = t(`clients.doc.${def.id}`);
                  return (
                    <div className="cf-doc cf-doc--multi" key={def.id}>
                      <div className="cf-doc__label">{defLabel}</div>
                      {list.length === 0 && <div className="cf-doc__thumb">{t('clients.noFile')}</div>}
                      <ul className="cf-doc__list">
                        {list.map((meta, index) => (
                          <li className="cf-doc__item" key={meta.key || `${meta.name}-${index}`}>
                            <span className="cf-doc__file" title={meta.name}>{meta.name}</span>
                            <Can perm="action:client.upload">
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() => handleRemoveOther(def.id, index)}
                              >
                                {t('clients.remove')}
                              </button>
                            </Can>
                          </li>
                        ))}
                      </ul>
                      <div className="cf-doc__btns">
                        <Can perm="action:client.upload">
                          <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                            {t('common.upload')}
                            <input
                              type="file"
                              accept={def.accept || OTHER_DOCUMENT_ACCEPT}
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                handleOtherFiles(e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </Can>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="legend">{t('clients.docsLegend')}</p>
            </div>
          </section>
        </div>
      </form>

      {confirmDocs && (
        <Modal
          title={t('clients.confirmDocsTitle')}
          onClose={() => setConfirmDocs(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setConfirmDocs(false)}
              >
                {t('clients.goBackUpload')}
              </button>
              <button type="button" className="btn btn--primary" onClick={performSave}>
                {t('clients.continueNoDocs')}
              </button>
            </>
          }
        >
          <p>{t('clients.missingDocsIntro')}</p>
          <ul>
            {missingDocs.map((def) => (
              <li key={def.id}>{t(`clients.doc.${def.id}`)}</li>
            ))}
          </ul>
          <p>{t('clients.missingDocsOutro')}</p>
        </Modal>
      )}

      <p className="legend">
        <Link to="/clients">{t('clients.backToClientsLink')}</Link>
      </p>
    </div>
  );
}
