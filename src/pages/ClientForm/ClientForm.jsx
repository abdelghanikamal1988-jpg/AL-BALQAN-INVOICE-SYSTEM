import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Can from '../../components/Can/Can.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
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
    title: 'Personal Details',
    note: 'Exactly as written in the passport.',
    fields: [
      { key: 'firstName', label: 'Name', type: 'text' },
      { key: 'fatherName', label: 'Father Name', type: 'text' },
      { key: 'surname', label: 'Surname', type: 'text' },
      { key: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female'] },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
      { key: 'placeOfBirth', label: 'Place of Birth', type: 'text' },
    ],
  },
  {
    id: 'passport',
    icon: 'folder',
    title: 'Passport Details',
    note: 'Text is converted to uppercase automatically.',
    fields: [
      { key: 'passport', label: 'Passport No.', type: 'text' },
      { key: 'country', label: 'Country Name', type: 'text' },
      { key: 'dateOfIssue', label: 'Date of Issue', type: 'date' },
      { key: 'dateOfExpiry', label: 'Date of Expiry', type: 'date' },
      { key: 'issuingPlace', label: 'Issuing Place', type: 'text' },
    ],
  },
  {
    id: 'referral',
    icon: 'userCheck',
    title: 'Referral',
    note: 'Used to group clients by the agent who brought them.',
    fields: [{ key: 'referralAgent', label: 'Referral Agent', type: 'agent' }],
  },
];

export default function ClientForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
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
            toast.error('Client not found.');
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
          toast.error(
            'Unable to load the client form. Run supabase/clients.sql in the Supabase SQL Editor first.'
          );
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
      toast.error('Enter the agent name.');
      return;
    }
    try {
      const row = await dbInsertAgent(name);
      setAgents((prev) => [...prev, row]);
      setAgentChoice(row.name);
      setForm((prev) => ({ ...prev, referralAgent: row.name }));
      setAddingAgent(false);
      setNewAgentName('');
      toast.success('Agent added.');
    } catch (err) {
      toast.error(err.message || 'Unable to add the agent.');
    }
  };

  /* ---------------------------- documents ---------------------------- */
  const handleFile = (docId, file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File is larger than 10 MB.');
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
          toast.success(
            'Changes submitted for approval. The client stays unchanged until an administrator approves.'
          );
          navigate(`/clients/${clientId}`);
        } else {
          await dbUpdateClient(client);
          toast.success('Client updated successfully.');
          navigate(`/clients/${clientId}`);
        }
      } else {
        await dbInsertClient(client);
        toast.success('Client saved successfully.');
        navigate(`/clients/${clientId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Unable to save the client. Please try again.');
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
      toast.error('Please fix the highlighted fields.');
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
            Loading client…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide clients-page">
      <div className="page-header">
        <div>
          <h1>{editing ? 'Edit Client' : 'New Client'}</h1>
          <p className="subtitle">
            {editing
              ? 'Update the client record. Documents can be replaced at any time.'
              : 'All fields are required. Documents are optional.'}
          </p>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="btn btn--neutral"
            onClick={() => navigate(editing ? `/clients/${id}` : '/clients')}
          >
            Cancel
          </button>
          <Can perm="action:client.save">
            <button
              type="submit"
              form="client-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? <span className="btn__spinner" aria-hidden="true" /> : editing ? 'Update Client' : 'Save Client'}
            </button>
          </Can>
        </div>
      </div>

      <form id="client-form" className="editor-layout" onSubmit={handleSubmit}>
        <div className="editor-form">
          {FIELD_GROUPS.map((group) => (
            <section className="card" aria-label={group.title} key={group.id}>
              <div className="card__header">
                <span className="card__icon" aria-hidden="true"><Icon name={group.icon} /></span>
                <h2>{group.title}</h2>
              </div>
              <div className="card__body">
                <p className="cf-section__note">{group.note}</p>
                <div className="cf-grid">
                  {group.fields.map((field) => {
                  const error = errors[field.key];
                  const wrapperClass = `field${error ? ' field--error' : ''}`;

                  if (field.type === 'agent') {
                    return (
                      <div className={wrapperClass} key={field.key}>
                        <label htmlFor="client-agent">
                          Referral Agent<span className="cf-req">*</span>
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
                          {canSave && <option value={ADD_AGENT}>+ Add new agent…</option>}
                        </select>
                        {canSave && addingAgent && (
                          <div className="cf-agent-add">
                            <input
                              type="text"
                              value={newAgentName}
                              placeholder="Agent name"
                              onChange={(e) => setNewAgentName(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={saveNewAgent}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="btn btn--neutral btn--sm"
                              onClick={() => setAddingAgent(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {error && <span className="field__error">{error}</span>}
                      </div>
                    );
                  }

                  if (field.type === 'select') {
                    return (
                      <div className={wrapperClass} key={field.key}>
                        <label htmlFor={`client-${field.key}`}>{field.label}<span className="cf-req">*</span></label>
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
                          <option value="">Select…</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {error && <span className="field__error">{error}</span>}
                      </div>
                    );
                  }

                  return (
                    <div className={wrapperClass} key={field.key}>
                      <label htmlFor={`client-${field.key}`}>{field.label}<span className="cf-req">*</span></label>
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
                      {error && <span className="field__error">{error}</span>}
                    </div>
                  );
                  })}
                </div>
              </div>
            </section>
          ))}

          <section className="card" aria-label="Documents">
            <div className="card__header">
              <span className="card__icon" aria-hidden="true"><Icon name="paperclip" /></span>
              <h2>Documents</h2>
            </div>
            <div className="card__body">
              <div className="cf-docs">
                {DOCUMENT_TYPES.map((def) => {
                  const meta = docs[def.id];
                  const preview = previews[def.id];
                  return (
                    <div className="cf-doc" key={def.id}>
                      <div className="cf-doc__label">{def.label}</div>
                      {preview ? (
                        meta && meta.type === 'application/pdf' ? (
                          <div className="cf-doc__thumb">PDF document</div>
                        ) : (
                          <img className="cf-doc__thumb" src={preview} alt={def.label} />
                        )
                      ) : (
                        <div className="cf-doc__thumb">No file</div>
                      )}
                      {meta && <div className="cf-doc__file">{meta.name}</div>}
                      <div className="cf-doc__btns">
                        <Can perm="action:client.upload">
                          <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                            {meta ? 'Replace' : 'Upload'}
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
                              Remove
                            </button>
                          )}
                        </Can>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="legend">
                Documents are optional — you can save the client without them.
              </p>
            </div>
          </section>
        </div>
      </form>

      {confirmDocs && (
        <Modal
          title="Continue without documents?"
          onClose={() => setConfirmDocs(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setConfirmDocs(false)}
              >
                Go back and upload
              </button>
              <button type="button" className="btn btn--primary" onClick={performSave}>
                Continue without them
              </button>
            </>
          }
        >
          <p>The following documents were not uploaded:</p>
          <ul>
            {missingDocs.map((def) => (
              <li key={def.id}>{def.label}</li>
            ))}
          </ul>
          <p>You can still save the client and add the documents later.</p>
        </Modal>
      )}

      <p className="legend">
        <Link to="/clients">Back to clients</Link>
      </p>
    </div>
  );
}
