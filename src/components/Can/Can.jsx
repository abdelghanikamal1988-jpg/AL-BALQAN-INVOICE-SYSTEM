import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Renders children only when the signed-in user has the permission.
 * Usage: <Can perm="action:invoice.delete"><button …/></Can>
 */
export default function Can({ perm, children, fallback = null }) {
  const { hasPerm } = useAuth();
  return hasPerm(perm) ? children : fallback;
}
