const steps = [
  { num: '01', title: 'Consultation' },
  { num: '02', title: 'Document Preparation' },
  { num: '03', title: 'Application & Processing' },
  { num: '04', title: 'Visa / Residency Completion' },
];

export default function HowItWorks() {
  return (
    <section className="ws-how">
      <h2 className="ws-section-title">HOW IT WORKS</h2>
      <p className="ws-section-subtitle">A Clear Path From Consultation to Completion</p>
      <div className="ws-how__grid">
        {steps.map((s) => (
          <div key={s.num} className="ws-step">
            <span className="ws-step__num">{s.num}</span>
            <div className="ws-step__line" />
            <h3 className="ws-step__title">{s.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
