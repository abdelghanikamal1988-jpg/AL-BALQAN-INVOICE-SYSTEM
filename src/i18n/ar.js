/**
 * AL BALQAN — Arabic dictionary (aggregator).
 * Each namespace lives in ./ar/<name>.js and is merged here.
 * Lookup order: Arabic → English → raw key.
 */

import common from './ar/common.js';
import shell from './ar/shell.js';
import dashboard from './ar/dashboard.js';
import clients from './ar/clients.js';
import invoice from './ar/invoice.js';
import admin from './ar/admin.js';
import website from './ar/website.js';
import data from './ar/data.js';

export default {
  ...common,
  ...shell,
  ...dashboard,
  ...clients,
  ...invoice,
  ...admin,
  ...website,
  ...data,
};
