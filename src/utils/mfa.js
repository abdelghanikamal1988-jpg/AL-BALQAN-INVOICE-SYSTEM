/**
 * Optional per-user two-factor authentication (TOTP) on top of Supabase Auth.
 *
 * Everything here is opt-in: a user without a verified factor logs in with a
 * password exactly as before. The building blocks are the same ones Supabase's
 * own client uses — enroll a factor, create a challenge, verify the code —
 * kept in one place so both the Settings page and the Login flow agree.
 */

import { supabase } from '../lib/supabase.js';

/** Returns the signed-in user's factors (verified and pending). */
export async function listFactors() {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all || []).filter((f) => f.factor_type === 'totp');
}

/** The verified TOTP factor, or null when the user has not finished setup. */
export async function activeTotpFactor() {
  const factors = await listFactors();
  return factors.find((f) => f.status === 'verified') || null;
}

/**
 * Whether a password sign-in still needs a 6-digit code to reach AAL2.
 * Users with no verified factor are never challenged.
 */
export async function needsChallenge() {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
}

/**
 * Starts the enrolment of a new TOTP factor. Returns the factor id together
 * with the QR code / secret so the app can show them once.
 */
export async function enrollTotp() {
  if (!supabase) throw new Error('Authentication is not configured.');
  const factors = await listFactors();
  if (factors.some((f) => f.status === 'verified')) {
    const err = new Error('Two-factor authentication is already on.');
    err.mfaAlreadyOn = true;
    throw err;
  }
  for (const f of factors) {
    await unenrollFactor(f.id).catch(() => null);
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'totp' });
  if (error) throw error;
  return {
    id: data.id,
    qrCode: data.totp?.qr_code || '',
    uri: data.totp?.uri || '',
    secret: data.totp?.secret || '',
  };
}

/** Starts a new challenge for a factor; the code must verify against its id. */
export async function createChallenge(factorId) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw error;
  return data;
}

/** Verifies a 6-digit code against a pending challenge. */
export async function verifyChallenge(factorId, challengeId, code) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw error;
}

/** Removes a factor entirely, turning 2FA back off for this account. */
export async function unenrollFactor(factorId) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
