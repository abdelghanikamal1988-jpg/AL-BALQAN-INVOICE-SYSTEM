import { useState } from 'react';
import { useLang } from '../../../context/LangContext.jsx';

const faqs = [
  {
    q: 'website.faq.q1',
    a: 'website.faq.a1',
  },
  {
    q: 'website.faq.q2',
    a: 'website.faq.a2',
  },
  {
    q: 'website.faq.q3',
    a: 'website.faq.a3',
  },
  {
    q: 'website.faq.q4',
    a: 'website.faq.a4',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);
  const { t } = useLang();

  return (
    <section className="ws-faq" id="faq">
      <h2 className="ws-section-title">{t('website.faq.title')}</h2>
      <p className="ws-section-subtitle">{t('website.faq.subtitle')}</p>
      <div className="ws-faq__list">
        {faqs.map((f, i) => (
          <div key={i} className={`ws-faq-item ${open === i ? 'ws-faq-item--open' : ''}`}>
            <button className="ws-faq-item__q" onClick={() => setOpen(open === i ? null : i)}>
              <span>{t(f.q)}</span>
              <span className="ws-faq-item__icon">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="ws-faq-item__a">{t(f.a)}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
