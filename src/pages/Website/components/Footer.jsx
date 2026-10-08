import { useLang } from '../../../context/LangContext.jsx';

export default function Footer() {
  const { t } = useLang();

  return (
    <footer className="ws-footer">
      <div className="ws-footer__inner">
        <div className="ws-footer__brand">
          <img src="/logo.png" alt={t('website.brand')} className="ws-footer__logo" />
          <p>
            {t('website.footer.about')}
          </p>
          <p style={{ marginTop: '16px' }}>
            {t('website.footer.license')}
          </p>
        </div>

        <div className="ws-footer__col">
          <h4>{t('website.footer.colPortfolios')}</h4>
          <ul>
            <li>{t('website.footer.p1')}</li>
            <li>{t('website.footer.p2')}</li>
            <li>{t('website.footer.p3')}</li>
            <li>{t('website.footer.p4')}</li>
            <li>{t('website.footer.p5')}</li>
          </ul>
        </div>

        <div className="ws-footer__col">
          <h4>{t('website.footer.colServices')}</h4>
          <ul>
            <li>{t('website.footer.s1')}</li>
            <li>{t('website.footer.s2')}</li>
            <li>{t('website.footer.s3')}</li>
            <li>{t('website.footer.s4')}</li>
            <li>{t('website.footer.s5')}</li>
          </ul>
        </div>

        <div className="ws-footer__col">
          <h4>{t('website.footer.colOffice')}</h4>
          <p>{t('website.footer.addr1')}</p>
          <p>{t('website.footer.addr2')}</p>
          <p>{t('website.footer.addr3')}</p>
          <p>{t('website.footer.phone')}</p>
          <p>{t('website.footer.email')}</p>
        </div>
      </div>

      <div className="ws-footer__bottom">
        <p>{t('website.footer.copyright')}</p>
        <div className="ws-footer__links">
          <a href="#">{t('website.footer.privacy')}</a>
          <a href="#">{t('website.footer.terms')}</a>
          <a href="#">{t('website.footer.disclosures')}</a>
        </div>
      </div>
    </footer>
  );
}
