import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import Services from './components/Services.jsx';
import Destinations from './components/Destinations.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import Consultation from './components/Consultation.jsx';
import Partners from './components/Partners.jsx';
import WhyAlBalqan from './components/WhyAlBalqan.jsx';
import FAQ from './components/FAQ.jsx';
import Footer from './components/Footer.jsx';
import './Website.css';

export default function Website() {
  return (
    <div className="ws-website">
      <Navbar />
      <Hero />
      <Services />
      <Destinations />
      <HowItWorks />
      <Consultation />
      <Partners />
      <WhyAlBalqan />
      <FAQ />
      <Footer />
    </div>
  );
}
