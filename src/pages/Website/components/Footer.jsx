export default function Footer() {
  return (
    <footer className="ws-footer">
      <div className="ws-footer__inner">
        <div className="ws-footer__brand">
          <img src="/logo.png" alt="AL BALQAN" className="ws-footer__logo" />
          <p>
            Premier cross-border sovereign mobility, golden residency,
            and executive consular services connecting the United Arab Emirates
            with Balkan corridor opportunities.
          </p>
          <p style={{ marginTop: '16px' }}>
            UAE Commercial License No. 1359681
          </p>
        </div>

        <div className="ws-footer__col">
          <h4>CORRIDOR PORTFOLIOS</h4>
          <ul>
            <li>Albania Residency</li>
            <li>Kosovo Investment</li>
            <li>Serbia Golden Visa</li>
            <li>Montenegro Corporate</li>
            <li>North Macedonia Pathway</li>
          </ul>
        </div>

        <div className="ws-footer__col">
          <h4>EXECUTIVE SERVICES</h4>
          <ul>
            <li>Investor &amp; Golden Visas</li>
            <li>Corporate Relocation &amp; Branching</li>
            <li>Executive Fast-Track Processing</li>
            <li>Cross-Border Property Acquisition</li>
            <li>Consular Legalization &amp; MOFA Attestation</li>
          </ul>
        </div>

        <div className="ws-footer__col">
          <h4>UAE HEAD OFFICE</h4>
          <p>Al Maryah Island / Sheikh Zayed Road</p>
          <p>Executive Tower, Dubai &amp; Abu Dhabi,</p>
          <p>United Arab Emirates</p>
          <p>(+971) 4 000 2026 / (+971) 2 000 2026</p>
          <p>advisory@albalqan.ae</p>
        </div>
      </div>

      <div className="ws-footer__bottom">
        <p>2026 AL BALQAN Tourism &amp; Visa Services Company LLC. All rights reserved.</p>
        <div className="ws-footer__links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Regulatory Disclosures</a>
        </div>
      </div>
    </footer>
  );
}
