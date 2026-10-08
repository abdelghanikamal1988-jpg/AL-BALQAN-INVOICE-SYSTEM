import { useLang } from '../../../context/LangContext.jsx';

const features = [
  {
    id: 1,
    title: 'website.why.f1.title',
    desc: 'website.why.f1.desc',
  },
  {
    id: 2,
    title: 'website.why.f2.title',
    desc: 'website.why.f2.desc',
  },
  {
    id: 3,
    title: 'website.why.f3.title',
    desc: 'website.why.f3.desc',
  },
  {
    id: 4,
    title: 'website.why.f4.title',
    desc: 'website.why.f4.desc',
  },
  {
    id: 5,
    title: 'website.why.f5.title',
    desc: 'website.why.f5.desc',
  },
  {
    id: 6,
    title: 'website.why.f6.title',
    desc: 'website.why.f6.desc',
  },
];

const IconSVG = () => (
  <svg viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22.5" cy="22.5" r="20" stroke="#D5AF33" strokeWidth="1.5"/>
    <path d="M15 22.5L20 27.5L30 17.5" stroke="#D5AF33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function WhyAlBalqan() {
  const { t } = useLang();

  return (
    <section className="ws-why">
      <h2 className="ws-section-title">{t('website.why.title')}</h2>
      <p className="ws-section-subtitle">{t('website.why.subtitle')}</p>
      <div className="ws-why__grid">
        {features.map((f) => (
          <div key={f.id} className="ws-why-card">
            <div className="ws-why-card__icon"><IconSVG /></div>
            <div>
              <h3 className="ws-why-card__title">{t(f.title)}</h3>
              <p className="ws-why-card__desc">{t(f.desc)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
