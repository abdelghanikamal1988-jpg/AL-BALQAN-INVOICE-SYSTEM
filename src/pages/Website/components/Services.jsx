import { useLang } from '../../../context/LangContext.jsx';

const services = [
  {
    id: 1,
    title: 'website.services.s1.title',
    desc: 'website.services.s1.desc',
    image: '/website-images/tourist-visa.jpg',
    variant: 'gold',
  },
  {
    id: 2,
    title: 'website.services.s2.title',
    desc: 'website.services.s2.desc',
    image: '/website-images/investor-residency.jpg',
    variant: 'navy',
  },
  {
    id: 3,
    title: 'website.services.s3.title',
    desc: 'website.services.s3.desc',
    image: '/website-images/investor-residency.jpg',
    variant: 'gold',
  },
];

export default function Services() {
  const { t } = useLang();

  return (
    <section className="ws-services" id="services">
      <h2 className="ws-section-title">{t('website.services.title')}</h2>
      <div className="ws-services__grid">
        {services.map((s) => (
          <div key={s.id} className="ws-service-card">
            <div className="ws-service-card__img">
              <img src={s.image} alt={t(s.title)} loading="lazy" decoding="async" />
            </div>
            <div className={`ws-service-card__body ws-service-card__body--${s.variant}`}>
              <h3 className="ws-service-card__title">{t(s.title)}</h3>
              <p className="ws-service-card__desc">{t(s.desc)}</p>
              <a href="#contact" className="ws-explore-link ws-explore-link--gold">
                {t('website.explore')} <span>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
