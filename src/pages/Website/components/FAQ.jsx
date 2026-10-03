import { useState } from 'react';

const faqs = [
  {
    q: 'What are the general visa requirements for UAE residents entering the Western Balkans?',
    a: 'Requirements vary by country but generally include a valid passport, proof of accommodation, travel insurance, and financial means. Contact us for specific requirements for your nationality.',
  },
  {
    q: 'How are employment contracts and work permits vetted and legally authenticated?',
    a: 'We work directly with government agencies and licensed employers to ensure all contracts are legally authenticated and meet local labor law requirements.',
  },
  {
    q: 'What minimum investment is necessary to qualify for European Balkan Investor Residency?',
    a: 'Investment thresholds vary by country. Albania and Kosovo offer some of the most competitive programs in Europe. Contact us for current requirements.',
  },
  {
    q: 'What are typical processing timelines from file lodgment to permit issuance?',
    a: 'Processing times range from 2-8 weeks depending on the country and service type. We provide regular updates throughout the process.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="ws-faq" id="faq">
      <h2 className="ws-section-title">REGULATORY CLARITY</h2>
      <p className="ws-section-subtitle">Frequently Asked Questions</p>
      <div className="ws-faq__list">
        {faqs.map((f, i) => (
          <div key={i} className={`ws-faq-item ${open === i ? 'ws-faq-item--open' : ''}`}>
            <button className="ws-faq-item__q" onClick={() => setOpen(open === i ? null : i)}>
              <span>{f.q}</span>
              <span className="ws-faq-item__icon">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="ws-faq-item__a">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
