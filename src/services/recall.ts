import { supabase } from '../lib/supabase';

/** Cliente al que hoy le corresponde el WhatsApp «ya es hora de volver» */
export interface RecallCandidate {
  phone: string;
  client_name: string;
  visits: number;
  every_days: number;
  last_visit: string;
  days_since: number;
  due_date: string;
  last_service_name: string;
  last_barber: string;
}

/** A quién le llegaría hoy (solo administradores; lo calcula la base: recall_candidates). */
export async function getRecallPreview(): Promise<RecallCandidate[]> {
  const { data, error } = await supabase.rpc('admin_recall_preview');
  if (error) throw error;
  return (data ?? []) as RecallCandidate[];
}
