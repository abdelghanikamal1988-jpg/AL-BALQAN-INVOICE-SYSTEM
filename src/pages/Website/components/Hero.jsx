import { useLang } from '../../../context/LangContext.jsx';

export default function Hero() {
  const { t } = useLang();

  return (
    <section className="ws-hero" id="home">
      <div className="ws-hero__bg">
        <img src="/website-images/hero-bg.jpg" alt="" className="ws-hero__bg-img" />
        <div className="ws-hero__overlay" />
      </div>
      <div className="ws-hero__bottom-fade" />
      <div className="ws-hero__content">
        <p className="ws-hero__subtitle">{t('website.hero.subtitle')}</p>
        <h1 className="ws-hero__title">{t('website.hero.title')}</h1>
        <p className="ws-hero__desc">
          {t('website.hero.desc')}
        </p>
        <div className="ws-hero__actions">
          <a href="#contact" className="ws-btn ws-btn--white">{t('website.hero.ctaConsult')}</a>
          <a href="#countries" className="ws-btn ws-btn--white">{t('website.hero.ctaCountries')}</a>
        </div>
      </div>
    </section>
  );
}
