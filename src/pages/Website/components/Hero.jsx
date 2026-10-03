export default function Hero() {
  return (
    <section className="ws-hero" id="home">
      <div className="ws-hero__bg">
        <img src="/website-images/hero-bg.jpg" alt="" className="ws-hero__bg-img" />
        <div className="ws-hero__overlay" />
      </div>
      <div className="ws-hero__bottom-fade" />
      <div className="ws-hero__content">
        <p className="ws-hero__subtitle">YOUR GATEWAY TO</p>
        <h1 className="ws-hero__title">BALKANS</h1>
        <p className="ws-hero__desc">
          Government-approved European residency, business establishment,
          work contracts, and bespoke travel advisory for distinguished
          individuals and corporations from the UAE.
        </p>
        <div className="ws-hero__actions">
          <a href="#contact" className="ws-btn ws-btn--white">Request a Consultation</a>
          <a href="#countries" className="ws-btn ws-btn--white">Explore our Countries</a>
        </div>
      </div>
    </section>
  );
}
