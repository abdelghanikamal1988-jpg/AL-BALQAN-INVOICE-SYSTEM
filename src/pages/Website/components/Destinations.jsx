const countries = [
  {
    id: 1,
    name: 'Albania',
    desc: 'Coastal gateway to Balkan investment opportunities',
    image: '/website-images/albania.jpg',
  },
  {
    id: 2,
    name: 'Kosovo',
    desc: 'Emerging market with fast-growing business potential',
    image: '/website-images/kosovo.jpg',
  },
  {
    id: 3,
    name: 'Montenegro',
    desc: 'Adriatic hub for residency and tourism',
    image: '/website-images/montenegro.jpg',
  },
  {
    id: 4,
    name: 'North Macedonia',
    desc: 'Strategic crossroads for regional trade access',
    image: '/website-images/north-macedonia.jpg',
  },
  {
    id: 5,
    name: 'Serbia',
    desc: 'Powerhouse for business and investment',
    image: '/website-images/serbia.jpg',
  },
];

export default function Destinations() {
  return (
    <section className="ws-destinations" id="countries">
      <h2 className="ws-section-title">DESTINATIONS</h2>
      <p className="ws-section-subtitle">Explore the Balkans</p>
      <div className="ws-destinations__grid">
        {countries.map((c) => (
          <div key={c.id} className="ws-country-card">
            <div className="ws-country-card__img">
              <img src={c.image} alt={c.name} />
            </div>
            <div className="ws-country-card__overlay" />
            <div className="ws-country-card__content">
              <h3 className="ws-country-card__name">{c.name}</h3>
              <p className="ws-country-card__desc">{c.desc}</p>
              <a href="#contact" className="ws-explore-link ws-explore-link--white">
                Explore <span>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
