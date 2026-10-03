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
  return (
    <section className="ws-partners">
      <h2 className="ws-section-title">OUR PARTNERS</h2>
      <p className="ws-section-subtitle">Entities & Organizations We Work With</p>
      <div className="ws-partners__track">
        <div className="ws-partners__scroll">
          {[...partners, ...partners].map((p, i) => (
            <div key={i} className="ws-partner-logo">
              <img src={p.image} alt={`Partner ${p.id}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
