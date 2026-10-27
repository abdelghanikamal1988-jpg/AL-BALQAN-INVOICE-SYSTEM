import { supabase } from './supabase.js';

export async function dbAttachVisa(clientId, meta) {
  const { data, error } = await supabase.rpc('attach_visa', {
    p_client_id: clientId,
    p_meta: meta,
  });
  if (error) throw error;
  return data;
}

export async function dbPublishVisa(clientId) {
  const { data, error } = await supabase.rpc('publish_visa', { p_client_id: clientId });
  if (error) throw error;
  return data;
}

export async function dbFetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, payload, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function dbMarkNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .eq('id', id);
  if (error) throw error;
}
