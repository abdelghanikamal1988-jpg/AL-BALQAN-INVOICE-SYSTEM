/**
 * Admin/users namespace — page header, user table,
 * permission matrix, modals and toasts.
 */

export default {
  'admin.eyebrow': 'Settings',
  'admin.title': 'Users',
  'admin.subtitle':
    'Create accounts for employees and delegates, and turn any page or button on or off for each of them.',
  'admin.home': 'Home',
  'admin.addUser': 'Add User',
  'admin.noAccess': 'Only admins can manage users.',
  'admin.loading': 'Loading users…',
  'admin.empty': 'No users yet. Create the first one.',

  'admin.stat.accounts': 'Accounts',
  'admin.stat.active': 'Active',
  'admin.stat.administrators': 'Administrators',

  'admin.col.user': 'User',
  'admin.col.role': 'Role',
  'admin.col.permissions': 'Permissions',
  'admin.col.created': 'Created',

  'admin.status.active': 'Active',
  'admin.status.disabled': 'Deactivated',

  'admin.action.edit': 'Edit user',
  'admin.action.setPassword': 'Set password',
  'admin.action.activate': 'Activate user',
  'admin.action.deactivate': 'Deactivate user',
  'admin.action.delete': 'Delete user',

  'admin.a11y.edit': 'Edit {email}',
  'admin.a11y.setPassword': 'Set password for {email}',
  'admin.a11y.activate': 'Activate {email}',
  'admin.a11y.deactivate': 'Deactivate {email}',
  'admin.a11y.delete': 'Delete {email}',

  'admin.role.admin': 'Admin',
  'admin.role.employee': 'Employee',
  'admin.role.delegate': 'Delegate',
  'admin.role.custom': 'Custom',

  'admin.form.fullName': 'Full name',
  'admin.form.email': 'Email',
  'admin.form.password': 'Password',
  'admin.form.passwordHint': 'Minimum 8 characters. Tell the user this password.',
  'admin.form.role': 'Role',
  'admin.form.roleHint':
    'Choosing a role fills the checklist below — you can still toggle anything.',
  'admin.form.newPassword': 'New password',
  'admin.form.passwordHint2':
    'Minimum 8 characters. The user will be signed out everywhere.',
  'admin.form.accountActive': 'Account is active (can sign in)',

  'admin.permGroup.title': 'Permissions',
  'admin.permGroup.selected': '{count} selected',
  'admin.permGroup.pages': 'Pages',
  'admin.permGroup.actions': 'Buttons & actions',

  'admin.modal.add': 'Add user',
  'admin.modal.edit': 'Edit {email}',
  'admin.modal.saveChanges': 'Save changes',
  'admin.modal.createUser': 'Create user',
  'admin.modal.setPassword': 'Set password — {email}',
  'admin.modal.setPasswordBtn': 'Set password',

  'admin.delete.title': 'Delete user?',
  'admin.delete.confirmBtn': 'Delete User',
  'admin.delete.bodyPre': 'This permanently deletes',
  'admin.delete.bodyPost':
    'and everything they created (their invoices, clients, documents and stored PDFs). This cannot be undone.',
  'admin.delete.identityTitle': 'Confirm your identity',
  'admin.delete.reason':
    'Enter your account credentials to permanently delete {email} and all of their data.',

  'admin.err.fullNameRequired': 'Full name is required.',
  'admin.err.emailInvalid': 'A valid email is required.',
  'admin.err.passwordShort': 'Password must be at least 8 characters.',

  'admin.toast.loadError': 'Could not load users: {msg}',
  'admin.toast.updated': 'User updated.',
  'admin.toast.created': 'User created. Share the email and password with them.',
  'admin.toast.activated': 'User activated.',
  'admin.toast.deactivated': 'User deactivated.',
  'admin.toast.passwordUpdated': 'Password updated for {email}.',
  'admin.toast.deleted': 'User deleted.',

  'admin.perm.page:dashboard': 'Dashboard',
  'admin.perm.page:invoice.create': 'New Invoice',
  'admin.perm.page:invoice.history': 'Invoice History',
  'admin.perm.page:clients': 'Clients History',
  'admin.perm.page:clients.new': 'New Client',
  'admin.perm.page:admin': 'Users (admin panel)',
  'admin.perm.action:invoice.save': 'Create / update invoices',
  'admin.perm.action:invoice.delete': 'Delete invoices',
  'admin.perm.action:invoice.export_pdf': 'Print / export invoice PDF',
  'admin.perm.action:invoice.export': 'Export data (JSON backup)',
  'admin.perm.action:invoice.import': 'Import data (JSON backup)',
  'admin.perm.action:client.save': 'Create / update clients',
  'admin.perm.action:client.delete': 'Delete clients',
  'admin.perm.action:client.status': 'Change application status',
  'admin.perm.action:client.upload': 'Upload / replace documents',
  'admin.perm.action:client.pdf': 'Generate client PDF',
};
