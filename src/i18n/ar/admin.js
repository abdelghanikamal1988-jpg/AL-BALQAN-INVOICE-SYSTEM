/**
 * المعجم العربي — لوحة المستخدمين: الجدول، مصفوفة الصلاحيات،
 * النوافذ والتنبيهات.
 */

export default {
  'admin.eyebrow': 'الإعدادات',
  'admin.title': 'لوحة المستخدمين',
  'admin.subtitle':
    'أنشئ حسابات للموظفين والمندوبين، وفعّل أو عطّل أي صفحة أو زر لكل منهم.',
  'admin.home': 'الرئيسية',
  'admin.addUser': 'إضافة مستخدم',
  'admin.noAccess': 'يمكن للمشرفين فقط إدارة المستخدمين.',
  'admin.loading': 'جارٍ تحميل المستخدمين…',
  'admin.empty': 'لا يوجد مستخدمون بعد. أنشئ أول مستخدم.',

  'admin.stat.accounts': 'الحسابات',
  'admin.stat.active': 'النشطون',
  'admin.stat.administrators': 'المشرفون',

  'admin.col.user': 'المستخدم',
  'admin.col.role': 'الدور',
  'admin.col.permissions': 'الصلاحيات',
  'admin.col.created': 'تاريخ الإنشاء',

  'admin.status.active': 'نشط',
  'admin.status.disabled': 'معطّل',

  'admin.action.edit': 'تعديل المستخدم',
  'admin.action.setPassword': 'تعيين كلمة المرور',
  'admin.action.activate': 'تفعيل المستخدم',
  'admin.action.deactivate': 'إيقاف المستخدم',
  'admin.action.delete': 'حذف المستخدم',

  'admin.a11y.edit': 'تعديل {email}',
  'admin.a11y.setPassword': 'تعيين كلمة المرور لـ {email}',
  'admin.a11y.activate': 'تفعيل {email}',
  'admin.a11y.deactivate': 'إيقاف {email}',
  'admin.a11y.delete': 'حذف {email}',

  'admin.role.admin': 'مدير',
  'admin.role.employee': 'موظف',
  'admin.role.delegate': 'مندوب',
  'admin.role.custom': 'مخصص',

  'admin.form.fullName': 'الاسم الكامل',
  'admin.form.email': 'البريد الإلكتروني',
  'admin.form.password': 'كلمة المرور',
  'admin.form.passwordHint': 'الحد الأدنى 8 أحرف. أخبر المستخدم بكلمة المرور هذه.',
  'admin.form.role': 'الدور',
  'admin.form.roleHint':
    'اختيار الدور يملأ قائمة الصلاحيات أدناه — ويمكنك تعديل أي بند.',
  'admin.form.newPassword': 'كلمة المرور الجديدة',
  'admin.form.passwordHint2':
    'الحد الأدنى 8 أحرف. سيتم تسجيل خروج المستخدم من جميع الأجهزة.',
  'admin.form.accountActive': 'الحساب نشط (يمكنه تسجيل الدخول)',

  'admin.permGroup.title': 'الصلاحيات',
  'admin.permGroup.selected': 'تم تحديد {count}',
  'admin.permGroup.pages': 'الصفحات',
  'admin.permGroup.actions': 'الأزرار والإجراءات',

  'admin.modal.add': 'إضافة مستخدم',
  'admin.modal.edit': 'تعديل {email}',
  'admin.modal.saveChanges': 'حفظ التغييرات',
  'admin.modal.createUser': 'إنشاء مستخدم',
  'admin.modal.setPassword': 'تعيين كلمة المرور — {email}',
  'admin.modal.setPasswordBtn': 'تعيين كلمة المرور',

  'admin.delete.title': 'حذف المستخدم؟',
  'admin.delete.confirmBtn': 'حذف المستخدم',
  'admin.delete.bodyPre': 'سيؤدي هذا إلى حذف',
  'admin.delete.bodyPost':
    'وكل ما أنشأه (فواتيره وعملاؤه ومستنداته وملفات PDF المحفوظة). لا يمكن التراجع عن هذا الإجراء.',
  'admin.delete.identityTitle': 'تأكيد هويتك',
  'admin.delete.reason':
    'أدخل بيانات حسابك لحذف {email} وجميع بياناته نهائيًا.',

  'admin.err.fullNameRequired': 'الاسم الكامل مطلوب.',
  'admin.err.emailInvalid': 'يلزم إدخال بريد إلكتروني صالح.',
  'admin.err.passwordShort': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',

  'admin.toast.loadError': 'تعذّر تحميل المستخدمين: {msg}',
  'admin.toast.updated': 'تم تحديث المستخدم.',
  'admin.toast.created': 'تم إنشاء المستخدم. شاركهم البريد الإلكتروني وكلمة المرور.',
  'admin.toast.activated': 'تم تفعيل المستخدم.',
  'admin.toast.deactivated': 'تم إيقاف المستخدم.',
  'admin.toast.passwordUpdated': 'تم تحديث كلمة المرور الخاصة بـ {email}.',
  'admin.toast.deleted': 'تم حذف المستخدم.',

  'admin.perm.page:dashboard': 'لوحة المعلومات',
  'admin.perm.page:invoice.create': 'فاتورة جديدة',
  'admin.perm.page:invoice.history': 'سجل الفواتير',
  'admin.perm.page:clients': 'سجل العملاء',
  'admin.perm.page:clients.new': 'عميل جديد',
  'admin.perm.page:admin': 'المستخدمون (لوحة الإدارة)',
  'admin.perm.action:invoice.save': 'إنشاء / تحديث الفواتير',
  'admin.perm.action:invoice.delete': 'حذف الفواتير',
  'admin.perm.action:invoice.export_pdf': 'طباعة / تصدير PDF للفاتورة',
  'admin.perm.action:invoice.export': 'تصدير البيانات (نسخة JSON احتياطية)',
  'admin.perm.action:invoice.import': 'استيراد البيانات (نسخة JSON احتياطية)',
  'admin.perm.action:client.save': 'إنشاء / تحديث العملاء',
  'admin.perm.action:client.delete': 'حذف العملاء',
  'admin.perm.action:client.status': 'تغيير حالة الطلب',
  'admin.perm.action:client.upload': 'رفع / استبدال المستندات',
  'admin.perm.action:client.pdf': 'إنشاء PDF للعميل',
};
