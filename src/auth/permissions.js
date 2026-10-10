/**
 * Single source of truth for user permissions.
 *
 * A permission is a string: "page:*" (route/menu visibility) or
 * "action:*" (button visibility). Stored per user in
 * public.profiles.permissions (jsonb array).
 *
 * role = "admin" is a wildcard (hasPerm() always true for admins).
 */

export const PAGE_PERMISSIONS = [
  { key: 'page:dashboard', label: 'Dashboard' },
  { key: 'page:invoice.create', label: 'New Invoice' },
  { key: 'page:invoice.history', label: 'Invoice History' },
  { key: 'page:clients', label: 'Clients History' },
  { key: 'page:clients.new', label: 'New Client' },
  { key: 'page:admin', label: 'Users (admin panel)' },
  { key: 'page:settings', label: 'Settings' },
];

export const ACTION_PERMISSIONS = [
  { key: 'action:invoice.save', label: 'Create / update invoices' },
  { key: 'action:invoice.delete', label: 'Delete invoices' },
  { key: 'action:invoice.export_pdf', label: 'Print / export invoice PDF' },
  { key: 'action:invoice.export', label: 'Export data (JSON backup)' },
  { key: 'action:invoice.import', label: 'Import data (JSON backup)' },
  { key: 'action:client.save', label: 'Create / update clients' },
  { key: 'action:client.delete', label: 'Delete clients' },
  { key: 'action:client.status', label: 'Change application status' },
  { key: 'action:client.upload', label: 'Upload / replace documents' },
  { key: 'action:client.pdf', label: 'Generate client PDF' },
];

export const ALL_PERMISSIONS = [
  ...PAGE_PERMISSIONS.map((p) => p.key),
  ...ACTION_PERMISSIONS.map((p) => p.key),
];

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'employee', label: 'Employee' },
  { value: 'delegate', label: 'Delegate' },
  { value: 'custom', label: 'Custom' },
];

/** Ready-made checklists — the admin can still toggle anything. */
export const ROLE_PRESETS = {
  admin: ALL_PERMISSIONS,
  employee: [
    'page:dashboard',
    'page:invoice.create',
    'page:invoice.history',
    'page:clients',
    'page:clients.new',
    'action:invoice.save',
    'action:invoice.delete',
    'action:invoice.export_pdf',
    'action:invoice.export',
    'action:invoice.import',
    'action:client.save',
    'action:client.status',
    'action:client.upload',
    'action:client.pdf',
  ],
  delegate: [
    'page:dashboard',
    'page:clients',
    'page:clients.new',
    'action:client.save',
    'action:client.status',
    'action:client.upload',
    'action:client.pdf',
  ],
  custom: [],
};

export function presetFor(role) {
  return ROLE_PRESETS[role] ?? [];
}
