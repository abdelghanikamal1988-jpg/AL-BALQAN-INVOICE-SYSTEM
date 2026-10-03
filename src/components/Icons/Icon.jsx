/**
 * Minimal line-icon set (24×24, 1.6 stroke, round caps) — matches the
 * Sidebar icon style so every pictogram in the system looks the same.
 *
 * Usage: <Icon name="bell" /> — the icon inherits `currentColor` and is
 * sized in `em`, so containers control it through font-size.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const PATHS = {
  bell: (
    <>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 5.4-2.2 7-2.2 7h16.4s-2.2-1.6-2.2-7" />
      <path d="M13.8 19a2 2 0 0 1-3.6 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3.2 1.9" />
    </>
  ),
  user: (
    <>
      <path d="M19.5 20.5v-1.7a4.3 4.3 0 0 0-4.3-4.3H8.8a4.3 4.3 0 0 0-4.3 4.3v1.7" />
      <circle cx="12" cy="7.8" r="3.9" />
    </>
  ),
  users: (
    <>
      <circle cx="9.2" cy="7.8" r="3.5" />
      <path d="M2.8 19.8v-1.6a4.2 4.2 0 0 1 4.2-4.2h4.4a4.2 4.2 0 0 1 4.2 4.2v1.6" />
      <path d="M16.4 4.8a3.5 3.5 0 0 1 0 6.3" />
      <path d="M21.2 19.8v-1.6a4.2 4.2 0 0 0-3.1-4" />
    </>
  ),
  userCheck: (
    <>
      <circle cx="9.5" cy="7.8" r="3.6" />
      <path d="M3 19.9v-1.7a4.3 4.3 0 0 1 4.3-4.3h3.8a4.3 4.3 0 0 1 4.3 4.3v1.7" />
      <path d="M15.6 18.4l2 2 3.8-4.2" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v16.9l-3 1.6-3-1.6-3 1.6-3-1.6z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4" />
    </>
  ),
  note: (
    <>
      <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" />
      <path d="M14 3.5V8.5H19" />
      <path d="M8.5 13h7" />
      <path d="M8.5 16.5h5" />
    </>
  ),
  paperclip: (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.19 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
  pencil: (
    <>
      <path d="M11 4.5H5.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V13" />
      <path d="M18.4 3.1a2.1 2.1 0 0 1 3 3L12 15.5l-4 1 1-4z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  plane: (
    <path d="M12 2.5c.7 0 1.3 1.9 1.3 4.4v2.4l7.2 4.1v1.9l-7.2-2.2v4.4l2.4 1.7v1.5L12 19.6l-3.7 1.1v-1.5l2.4-1.7v-4.4l-7.2 2.2v-1.9l7.2-4.1V6.9C10.7 4.4 11.3 2.5 12 2.5z" />
  ),
  folder: (
    <path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l2.1 2.6h7.7a2 2 0 0 1 2 2v7.9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  ),
  x: (
    <>
      <path d="M6.5 6.5l11 11" />
      <path d="M17.5 6.5l-11 11" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20.5 20.5l-4.4-4.4" />
    </>
  ),
};

export default function Icon({ name, className = '', ...rest }) {
  const shapes = PATHS[name];
  if (!shapes) return null;
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...STROKE}
      {...rest}
    >
      {shapes}
    </svg>
  );
}
