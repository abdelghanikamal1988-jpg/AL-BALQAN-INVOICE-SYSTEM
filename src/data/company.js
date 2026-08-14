/**
 * AL BALQAN — Company Configuration
 * All company information lives here in ONE file so it can be
 * edited easily in the future without touching any component.
 */

const company = {
  name: 'AL BALQAN Tourism & Visa Services Company',
  shortName: 'AL BALQAN',
  legalName: 'AL BALQAN Tourism & Visa Services Company',
  licenseNo: '139681',
  phone: '+971 6 749 4905',
  email: 'info@albalqan.com',
  website: 'www.albalqan.com',
  address: '101 Sara Plaza (2), Al Jurf (2), Al Ittihad St, Ajman, UAE',
  city: 'Ajman, UAE',
  country: 'United Arab Emirates',
  established: 2026,
  currency: 'AED',
  /**
   * BASE_URL is '/' in the dev server and './' in the built app,
   * so the logo works both when served and when opening dist/index.html
   * directly from disk.
   */
  logo: `${import.meta.env.BASE_URL}logo.png`,
  /**
   * Invoice disclaimer. Editable or removable from here.
   */
  invoiceDisclaimer:
    'This invoice confirms the service/payment details stated above and does not constitute a guarantee of visa or residence approval.',
};

export default company;
