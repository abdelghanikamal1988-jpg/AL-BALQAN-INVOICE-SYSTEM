/**
 * AL BALQAN — Services Configuration
 * To add a new service in the future, edit this file ONLY.
 * The form, preview, PDF and history update automatically.
 *
 * showResidenceType: controls whether the "Residence Type" field
 * appears for this service in the form.
 */

const services = [
  {
    id: 'tourist-visa',
    label: 'Tourist Visa',
    showResidenceType: false,
  },
  {
    id: 'residence',
    label: 'Residence',
    showResidenceType: true,
  },
  {
    id: 'investor-residence',
    label: 'Investor Residence',
    showResidenceType: true,
  },
  {
    id: 'work-contract',
    label: 'Work Contract',
    showResidenceType: false,
  },
];

export default services;
