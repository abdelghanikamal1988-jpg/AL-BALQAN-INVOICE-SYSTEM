const features = [
  {
    id: 1,
    title: '20+ Years Team Experience',
    desc: 'Consular officers, licensed attorneys, and corporate relocation directors bringing two decades of grounded execution.',
  },
  {
    id: 2,
    title: 'Integrated Services',
    desc: 'All-in-one solutions encompassing visas, bank account introduction, notary legalizations, tax ID issuance, and real estate review.',
  },
  {
    id: 3,
    title: 'Balkan-Focused Expertise',
    desc: 'Hyper-specialized focus exclusively on the 5 Balkan states rather than diluted, generic worldwide offerings.',
  },
  {
    id: 4,
    title: 'Family Solutions',
    desc: 'Turnkey dependent synchronization ensuring schooling approvals, European health coverage, and unified residency renewal cycles.',
  },
  {
    id: 5,
    title: 'Personalized Guidance',
    desc: 'Dedicated senior case managers based in Dubai and Abu Dhabi providing direct, single-point-of-contact accountability.',
  },
  {
    id: 6,
    title: 'Absolute Confidentiality',
    desc: 'Institutional-grade non-disclosure, encrypted client data infrastructure, and non-negotiable discretion for private clients.',
  },
];

const IconSVG = () => (
  <svg viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22.5" cy="22.5" r="20" stroke="#D5AF33" strokeWidth="1.5"/>
    <path d="M15 22.5L20 27.5L30 17.5" stroke="#D5AF33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function WhyAlBalqan() {
  return (
    <section className="ws-why">
      <h2 className="ws-section-title">INSTITUTIONAL FOUNDATION</h2>
      <p className="ws-section-subtitle">Why Al Balqan</p>
      <div className="ws-why__grid">
        {features.map((f) => (
          <div key={f.id} className="ws-why-card">
            <div className="ws-why-card__icon"><IconSVG /></div>
            <div>
              <h3 className="ws-why-card__title">{f.title}</h3>
              <p className="ws-why-card__desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
