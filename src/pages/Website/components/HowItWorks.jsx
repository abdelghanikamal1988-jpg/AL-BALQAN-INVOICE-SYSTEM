import { useLang } from '../../../context/LangContext.jsx';

const steps = [
  { num: '01', title: 'website.how.step1' },
  { num: '02', title: 'website.how.step2' },
  { num: '03', title: 'website.how.step3' },
  { num: '04', title: 'website.how.step4' },
];

export default function HowItWorks() {
  const { t } = useLang();

  return (
    <section className="ws-how">
      <h2 className="ws-section-title">{t('website.how.title')}</h2>
      <p className="ws-section-subtitle">{t('website.how.subtitle')}</p>
      <div className="ws-how__grid">
        {steps.map((s) => (
          <div key={s.num} className="ws-step">
            <span className="ws-step__num">{s.num}</span>
            <div className="ws-step__line" />
            <h3 className="ws-step__title">{t(s.title)}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
