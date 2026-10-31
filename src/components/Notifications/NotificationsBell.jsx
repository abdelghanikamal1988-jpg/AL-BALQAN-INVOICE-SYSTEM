import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../Modal/Modal.jsx';
import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { dbFetchNotifications, dbMarkNotificationRead } from '../../lib/visaRepo.js';

function notifTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function notifText(item, t) {
  if (item.type === 'visa_published') {
    const name = item.payload?.name || item.payload?.fileNo || '';
    return name
      ? t('notif.visaPublished', { name })
      : t('notif.visaPublishedGeneric');
  }
  if (item.type === 'consultation_new') {
    const count = Number(item.payload?.count || 0);
    return count > 0
      ? t('notif.consultationNew', { count })
      : t('notif.consultationNewGeneric');
  }
  return item.type;
}

export default function NotificationsBell() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setItems(await dbFetchNotifications());
    } catch (err) {
      console.warn('Notifications could not be loaded', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const unread = items.filter((item) => !item.read_at).length;

  const openItem = (item) => {
    const apply = async () => {
      if (item.read_at) return;
      await dbMarkNotificationRead(item.id);
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, read_at: now } : x))
      );
    };
    apply().catch(() => {});
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const markAllRead = async () => {
    try {
      const pending = items.filter((item) => !item.read_at);
      await Promise.all(pending.map((item) => dbMarkNotificationRead(item.id)));
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    } catch (err) {
      console.warn('Notifications could not be updated', err);
    }
  };

  return (
    <>
      <button
        type="button"
        className="app-header__bell"
        onClick={() => setOpen(true)}
        title={t('shell.notifications')}
        aria-label={t('shell.notifications')}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="app-header__bell-count" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <Modal
          title="shell.notifications"
          onClose={() => setOpen(false)}
          actions={
            unread > 0 ? (
              <button type="button" className="btn btn--neutral" onClick={markAllRead}>
                {t('notif.markAllRead')}
              </button>
            ) : null
          }
        >
          {items.length === 0 ? (
            <p className="notif-empty">{t('notif.empty')}</p>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notif-item${item.read_at ? '' : ' is-unread'}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="notif-item__text">{notifText(item, t)}</span>
                    <span className="notif-item__time">{notifTime(item.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
