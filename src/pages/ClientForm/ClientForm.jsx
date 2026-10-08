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
import {
  DOCUMENT_TYPES,
  DOCUMENT_ACCEPT,
  MAX_UPLOAD_BYTES,
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
  const { hasPerm, needsEditApproval } = useAuth();
  const canSave = hasPerm('action:client.save');
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
          setDocs(client.documents || {});
          setAgentChoice(client.referralAgent || CUSTOMER);
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
        const meta = docs[def.id];
        if (meta && meta.path) {
          try {
            urls[def.id] = await documentUrl(meta.path);
          } catch (err) {
            urls[def.id] = null;
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
    setForm((prev) => ({ ...prev, referralAgent: value }));
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
      setForm((prev) => ({ ...prev, referralAgent: row.name }));
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

  const missingDocs = DOCUMENT_TYPES.filter((def) => !docs[def.id]);
  const agentValue = addingAgent ? newAgentName.trim() : agentChoice;

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
        Object.entries(pending).map(async ([docId, file]) => {
          const uploaded = await uploadClientDocument(userId, clientId, docId, file);
          nextDocs[docId] = uploaded;
        })
      );

      if (!pendingApproval) {
        await Promise.all(stalePaths.map((path) => removeClientDocument(path).catch(() => {})));
      }

      let resolvedAgent = agentValue;
      if (addingAgent && resolvedAgent) {
        try {
          const row = await dbInsertAgent(resolvedAgent);
          setAgents((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
          resolvedAgent = row.name || resolvedAgent;
          setAgentChoice(resolvedAgent);
          setAddingAgent(false);
          setNewAgentName('');
        } catch (err) {
          console.warn('Agent kept on the client only:', err);
        }
      }

      const client = formToClient({ ...form, referralAgent: resolvedAgent }, {
        id: clientId,
        documents: nextDocs,
        pdfPath: existing?.pdfPath || null,
      });

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
          {FIELD_GROUPS.map((group) => (
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
                              onChange={(e) => setNewAgentName(e.target.value)}
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
                        {error && <span className="field__error">{t(`clients.err.${field.key}`)}</span>}
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
                        {error && <span className="field__error">{t(`clients.err.${field.key}`)}</span>}
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
                            field.type === 'text' ? e.target.value.toUpperCase() : e.target.value;
                          setForm((prev) => ({ ...prev, [field.key]: value }));
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next[field.key];
                            return next;
                          });
                        }}
                      />
                      {error && <span className="field__error">{t(`clients.err.${field.key}`)}</span>}
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
                {DOCUMENT_TYPES.map((def) => {
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
                          <img className="cf-doc__thumb" src={preview} alt={defLabel} />
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
