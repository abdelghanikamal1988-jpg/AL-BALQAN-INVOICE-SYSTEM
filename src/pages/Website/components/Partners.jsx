import { useLang } from '../../../context/LangContext.jsx';

const partners = [
  { id: 1, image: '/website-images/partner-1.jpg' },
  { id: 2, image: '/website-images/partner-2.jpg' },
  { id: 3, image: '/website-images/partner-3.jpg' },
  { id: 4, image: '/website-images/partner-4.jpg' },
  { id: 5, image: '/website-images/partner-5.jpg' },
  { id: 6, image: '/website-images/partner-6.jpg' },
  { id: 7, image: '/website-images/partner-7.jpg' },
  { id: 8, image: '/website-images/partner-8.jpg' },
];

export default function Partners() {
  const { t } = useLang();

  return (
    <section className="ws-partners">
      <h2 className="ws-section-title">{t('website.partners.title')}</h2>
      <p className="ws-section-subtitle">{t('website.partners.subtitle')}</p>
      <div className="ws-partners__track">
        <div className="ws-partners__scroll">
          {[...partners, ...partners].map((p, i) => (
            <div key={i} className="ws-partner-logo">
              <img src={p.image} alt={t('website.partners.logoAlt', { n: p.id })} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
