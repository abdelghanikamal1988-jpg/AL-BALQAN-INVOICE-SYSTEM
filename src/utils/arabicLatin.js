/**
 * Arabic -> Latin transliteration used by the PDF builders.
 *
 * Official documents (passports, visas, client forms) travel in Latin
 * script, so any Arabic value that slipped into an old record is turned
 * into readable Latin here rather than being erased. New input is blocked
 * at the form level, so this only ever runs on legacy rows.
 *
 * The mapping is not a full linguistic transliterator — it covers the
 * letters, digits and common place names that actually appear in this
 * business's records.
 */

const LETTERS = {
  'ا': 'A', 'أ': 'A', 'إ': 'I', 'آ': 'A',
  'ب': 'B', 'ة': 'A',
  'ت': 'T', 'ث': 'TH', 'ج': 'J', 'ح': 'H', 'خ': 'KH',
  'د': 'D', 'ذ': 'DH', 'ر': 'R', 'ز': 'Z',
  'س': 'S', 'ش': 'SH', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z',
  'ع': 'A', 'غ': 'GH', 'ف': 'F', 'ق': 'Q', 'ك': 'K',
  'ل': 'L', 'م': 'M', 'ن': 'N', 'ه': 'H', 'و': 'W', 'ي': 'Y',
  'ى': 'A', 'ؤ': 'O', 'ئ': 'E', 'ء': '',
};

const DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/* Common words that appear in client records. */
const WORDS = {
  'القاهرة': 'CAIRO', 'الاسكندرية': 'ALEXANDRIA', 'الإسكندرية': 'ALEXANDRIA',
  'الجيزة': 'GIZA', 'المنصورة': 'MANSOURA', 'المنية': 'MENYA',
  'طنطا': 'TANTA', 'أسيوط': 'ASSIUT', 'بورسعيد': 'PORT SAID',
  'السويس': 'SUEZ', 'الإسماعيلية': 'ISMAILIA', 'الاسماعيلية': 'ISMAILIA',
  'دمياط': 'DAMIETTA', 'كفر الشيخ': 'KAFR EL SHEIKH',
  'الفيوم': 'FAYOUM', 'بني سويف': 'BENI SUEF', 'المنيا': 'MINYA',
  'أسيوط': 'ASSIUT', 'سوهاج': 'SOHAG', 'قنا': 'QENA',
  'الأقصر': 'LUXOR', 'الاقصر': 'LUXOR', 'أسوان': 'ASWAN', 'اسوان': 'ASWAN',
  'البحر الأحمر': 'RED SEA', 'البحر الاحمر': 'RED SEA',
  'الوادي الجديد': 'NEW VALLEY', 'الوادي الجديد': 'NEW VALLEY',
  'شمال سيناء': 'NORTH SINAI', 'جنوب سيناء': 'SOUTH SINAI',
  'الساحل الشمالي': 'NORTH COAST',
  'مصر': 'EGYPT', 'السودان': 'SUDAN', 'السعودية': 'SAUDI ARABIA',
  'الإمارات': 'UAE', 'الامارات': 'UAE', 'دبي': 'DUBAI',
  'أبوظبي': 'ABU DHABI', 'ابوظبي': 'ABU DHABI', 'الشارقة': 'SHARJAH',
  'العين': 'AL AIN', 'الفجيرة': 'FUJEIRA', 'أم القيوين': 'UMM AL QUWAIN',
  'المنامة': 'MANAMA', 'الكويت': 'KUWAIT', 'الدوحة': 'DOHA',
  'مسقط': 'MUSCAT', 'بغداد': 'BAGHDAD', 'عمّان': 'AMMAN', 'عمان': 'AMMAN',
  'بيروت': 'BEIRUT', 'دمشق': 'DAMASCUS', 'القدس': 'JERUSALEM',
  'غزة': 'GAZA', 'الرامة': 'RAMALLAH', 'الخليل': 'HEBRON',
  'نابلس': 'NABLUS', 'طولكرم': 'TULKAREM', 'جنين': 'JENIN',
  'الرباط': 'RABAT', 'الدار البيضاء': 'CASABLANCA', 'فاس': 'FEZ',
  'مراكش': 'MARRAKECH', 'تونس': 'TUNIS', 'طرابلس': 'TRIPOLI',
  'بنغازي': 'BENGHAZI', 'الخرطوم': 'KHARTOUM', 'أم درمان': 'OMDURMAN',
  'إسطنبول': 'ISTANBUL', 'اسطنبول': 'ISTANBUL', 'أنقرة': 'ANKARA',
  'أنطاليا': 'ANTALYA', 'بورصة': 'BURSA', 'إزمير': 'IZMIR', 'ازمير': 'IZMIR',
};

const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);

const ARABIC_BLOCKS = [
  [0x0600, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08ff],
  [0xfb50, 0xfdff],
  [0xfe70, 0xfeff],
];

const ARABIC_RE = new RegExp(
  '[' +
    ARABIC_BLOCKS.map(([from, to]) => String.fromCharCode(from) + '-' + String.fromCharCode(to)).join('') +
    String.fromCharCode(0x061c) +
    ']',
);

/** True when the value contains any Arabic-script character. */
export function containsArabic(value) {
  return ARABIC_RE.test(String(value ?? ''));
}

/**
 * Turns Arabic text into uppercase Latin. Whitespace is collapsed and the
 * result is trimmed. Non-Arabic text is only uppercased.
 */
export function transliterateArabic(value) {
  let text = String(value ?? '');

  /* Longest known words first so القاهرة becomes CAIRO, not nonsense. */
  for (const word of WORD_KEYS) {
    text = text.split(word).join(` ${WORDS[word]} `);
  }

  let out = '';
  for (const ch of text) {
    if (DIGITS[ch]) out += DIGITS[ch];
    else if (LETTERS[ch] !== undefined) out += LETTERS[ch];
    else out += ch;
  }

  return out
    .replace(/[\u064B-\u0652\u0670]/g, '') /* harakat */
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * PDF-safe text: Latin capitals only. Arabic is transliterated rather than
 * stripped so an old record never turns into a blank field on the form.
 */
export function pdfSafeText(value) {
  const raw = String(value ?? '');
  if (!containsArabic(raw)) {
    return raw
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const latin = transliterateArabic(raw);
  return latin
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
