import { useLang } from '../../../context/LangContext.jsx';

const countries = [
  {
    id: 1,
    name: 'website.destinations.d1.name',
    desc: 'website.destinations.d1.desc',
    image: '/website-images/albania.jpg',
  },
  {
    id: 2,
    name: 'website.destinations.d2.name',
    desc: 'website.destinations.d2.desc',
    image: '/website-images/kosovo.jpg',
  },
  {
    id: 3,
    name: 'website.destinations.d3.name',
    desc: 'website.destinations.d3.desc',
    image: '/website-images/montenegro.jpg',
  },
  {
    id: 4,
    name: 'website.destinations.d4.name',
    desc: 'website.destinations.d4.desc',
    image: '/website-images/north-macedonia.jpg',
  },
  {
    id: 5,
    name: 'website.destinations.d5.name',
    desc: 'website.destinations.d5.desc',
    image: '/website-images/serbia.jpg',
  },
];

export default function Destinations() {
  const { t } = useLang();

  return (
    <section className="ws-destinations" id="countries">
      <h2 className="ws-section-title">{t('website.destinations.title')}</h2>
      <p className="ws-section-subtitle">{t('website.destinations.subtitle')}</p>
      <div className="ws-destinations__grid">
        {countries.map((c) => (
          <div key={c.id} className="ws-country-card">
            <div className="ws-country-card__img">
              <img src={c.image} alt={t(c.name)} loading="lazy" decoding="async" />
            </div>
            <div className="ws-country-card__overlay" />
            <div className="ws-country-card__content">
              <h3 className="ws-country-card__name">{t(c.name)}</h3>
              <p className="ws-country-card__desc">{t(c.desc)}</p>
              <a href="#contact" className="ws-explore-link ws-explore-link--white">
                {t('website.explore')} <span>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
