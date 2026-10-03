import { useState } from 'react';

const CheckIcon = () => (
  <svg viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1.5C7.65 1.5 2.5 6.65 2.5 13C2.5 19.35 7.65 24.5 14 24.5C20.35 24.5 25.5 19.35 25.5 13C25.5 6.65 20.35 1.5 14 1.5ZM10.5 18.5L5.5 13.5L7.15 11.85L10.5 15.2L16.85 8.85L18.5 10.5L10.5 18.5Z" fill="#D5AF33"/>
  </svg>
);

export default function Consultation() {
  const [form, setForm] = useState({
    name: '', phone: '', residence: '', email: '',
    nationality: '', country: '', service: '', details: '', consent: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you! We will contact you within 24 business hours.');
    setForm({ name: '', phone: '', residence: '', email: '', nationality: '', country: '', service: '', details: '', consent: false });
  };

  return (
    <section className="ws-consultation" id="contact">
      <div className="ws-consultation__inner">
        <div className="ws-consultation__sidebar">
          <h2 className="ws-consultation__sidebar-title">
            Start Your Sovereign Mobility Assessment
          </h2>
          <p className="ws-consultation__sidebar-desc">
            Submit your profile for review. Our executive advisors verify
            Balkan eligibility parameters prior to formal consultation scheduling.
          </p>
          <ul className="ws-consultation__features">
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title">Evaluation Window</span>
                <span className="ws-consultation__feature-desc">Initial eligibility review within 24 business hours.</span>
              </div>
            </li>
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title ws-consultation__feature-title--bold">Strictly Confidential</span>
                <span className="ws-consultation__feature-desc">Zero third-party broker dissemination. Fully UAE-regulated data storage.</span>
              </div>
            </li>
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title">Direct Consular Support</span>
                <span className="ws-consultation__feature-desc">advisory@albalqan.ae<br/>+971 4 000 2026</span>
              </div>
            </li>
          </ul>
          <div className="ws-consultation__license">
            <p>COMPANY LICENSE</p>
            <p>UAE Commercial Reg: 135961</p>
          </div>
        </div>

        <form className="ws-consultation__form" onSubmit={handleSubmit}>
          <h3 className="ws-consultation__form-title">
            REQUEST A CONSULTATION
          </h3>
          <p className="ws-consultation__form-desc">
            Please fill out all mandatory criteria below. Nationality is required to assess sovereign bilateral visa protocols.
          </p>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>Full Name *</label>
              <input type="text" name="name" placeholder="e.g Tariq Al Mansoor" value={form.name} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>Email Address *</label>
              <input type="email" name="email" placeholder="e.g t.almansoor@domin.ae" value={form.email} onChange={handleChange} required />
            </div>
          </div>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>Phone Number (With Country Code) *</label>
              <input type="tel" name="phone" placeholder="+971 50 000 0000" value={form.phone} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>Nationality (Mandatory for Eligibility) *</label>
              <input type="text" name="nationality" placeholder="e.g Emirati, Saudi, British, Egyptian" value={form.nationality} onChange={handleChange} required />
            </div>
          </div>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>Country of Residence *</label>
              <input type="text" name="residence" placeholder="e.g United Arab Emirates" value={form.residence} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>Preferred Country *</label>
              <select name="country" value={form.country} onChange={handleChange} required>
                <option value="">Select Destination</option>
                <option value="albania">Albania</option>
                <option value="kosovo">Kosovo</option>
                <option value="montenegro">Montenegro</option>
                <option value="north-macedonia">North Macedonia</option>
                <option value="serbia">Serbia</option>
              </select>
            </div>
            <div className="ws-form-group">
              <label>Service Type *</label>
              <select name="service" value={form.service} onChange={handleChange} required>
                <option value="">Select Pathway</option>
                <option value="tourist-visa">Tourist Visa</option>
                <option value="investor-residency">Investor Residency</option>
                <option value="work-contract">Work Contract & Residency</option>
              </select>
            </div>
          </div>

          <div className="ws-form-group ws-form-group--full">
            <label>Case Details or Specific Objectives *</label>
            <textarea
              name="details"
              placeholder="Briefly detail your timeline, family members involved, and any specific objectives."
              value={form.details}
              onChange={handleChange}
              rows={4}
              required
            />
          </div>

          <label className="ws-checkbox">
            <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} required />
            <span>
              hereby consent to AL BALQAN Tourism & Visa Services Company LLC
              processing my biographical data for sovereign eligibility verification
              under UAE Federal Data Protection standards.
            </span>
          </label>

          <button type="submit" className="ws-btn ws-btn--dark">Submit Consultation Request</button>
        </form>
      </div>
    </section>
  );
}
