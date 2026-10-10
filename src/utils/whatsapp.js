export function whatsappDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^00/, '');
  if (d.startsWith('0')) d = `971${d.slice(1)}`;
  else if (d.length === 9) d = `971${d}`;
  return d;
}

export function whatsappShareUrl(phone, text) {
  const encoded = encodeURIComponent(String(text || ''));
  const digits = whatsappDigits(phone);
  return digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
