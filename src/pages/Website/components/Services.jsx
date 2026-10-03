const services = [
  {
    id: 1,
    title: 'Tourist Visa',
    desc: 'Professional assistance with tourist visa applications, document preparation, and application processing for selected Balkan destinations.',
    image: '/website-images/tourist-visa.jpg',
    variant: 'gold',
  },
  {
    id: 2,
    title: 'Investor Residency',
    desc: 'Explore residency opportunities through business formation and investment solutions in selected Balkan countries.',
    image: '/website-images/investor-residency.jpg',
    variant: 'navy',
  },
  {
    id: 3,
    title: 'Work Contracts & Residency',
    desc: 'Assistances with work contract and residency procedures for individuals seeking professional opportunities in the Balkans.',
    image: '/website-images/investor-residency.jpg',
    variant: 'gold',
  },
];

export default function Services() {
  return (
    <section className="ws-services" id="services">
      <h2 className="ws-section-title">OUR SERVICES</h2>
      <div className="ws-services__grid">
        {services.map((s) => (
          <div key={s.id} className="ws-service-card">
            <div className="ws-service-card__img">
              <img src={s.image} alt={s.title} />
            </div>
            <div className={`ws-service-card__body ws-service-card__body--${s.variant}`}>
              <h3 className="ws-service-card__title">{s.title}</h3>
              <p className="ws-service-card__desc">{s.desc}</p>
              <a href="#contact" className="ws-explore-link ws-explore-link--gold">
                Explore <span>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
