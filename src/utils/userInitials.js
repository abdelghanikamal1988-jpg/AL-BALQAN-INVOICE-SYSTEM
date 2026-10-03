/** Short initials used for the user avatar (sidebar + header). */
export function userInitials(user) {
  const source = (user?.email || user?.user_metadata?.name || 'User').trim();
  const local = source.includes('@') ? source.split('@')[0] : source;
  const parts = local.split(/[._\-+\s]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
