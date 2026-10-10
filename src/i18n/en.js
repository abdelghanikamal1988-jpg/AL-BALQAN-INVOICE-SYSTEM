/**
 * AL BALQAN — English dictionary (aggregator).
 * Each namespace lives in ./en/<name>.js and is merged here.
 * Lookup order: current language → English → raw key.
 */

import common from './en/common.js';
import shell from './en/shell.js';
import dashboard from './en/dashboard.js';
import clients from './en/clients.js';
import invoice from './en/invoice.js';
import admin from './en/admin.js';
import website from './en/website.js';
import data from './en/data.js';
import settings from './en/settings.js';

export default {
  ...common,
  ...shell,
  ...dashboard,
  ...clients,
  ...invoice,
  ...admin,
  ...website,
  ...data,
  ...settings,
};
