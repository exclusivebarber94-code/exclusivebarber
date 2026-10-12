import { supabase } from '../lib/supabase';

export interface ContactMessage {
  id: string;
  name: string;
  /** Celular normalizado: solo dígitos, sin el 57 inicial */
  phone: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type ContactMessageError = 'INVALID_NAME' | 'INVALID_PHONE' | 'INVALID_MESSAGE' | 'TOO_MANY_MESSAGES' | 'UNKNOWN';

const KNOWN: ContactMessageError[] = ['INVALID_NAME', 'INVALID_PHONE', 'INVALID_MESSAGE', 'TOO_MANY_MESSAGES'];

export class ContactMessageSendError extends Error {
  constructor(public code: ContactMessageError, public cause?: unknown) {
    super(code);
    this.name = 'ContactMessageSendError';
  }
}

/** Envía un mensaje desde el chat de la web. Lo puede usar cualquier visitante. */
export async function sendContactMessage(name: string, phone: string, message: string): Promise<void> {
  const { error } = await supabase.rpc('send_contact_message', { p_name: name, p_phone: phone, p_message: message });
  if (error) {
    throw new ContactMessageSendError(KNOWN.find((c) => c === error.message) ?? 'UNKNOWN', error);
  }
}

// --- Solo administradores ---------------------------------------------------

export async function getContactMessages(limit = 200): Promise<ContactMessage[]> {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, name, phone, message, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as { id: string; name: string; phone: string; message: string; read: boolean; created_at: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    message: r.message,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function setContactMessageRead(id: string, read: boolean): Promise<void> {
  const { error } = await supabase.from('contact_messages').update({ read }).eq('id', id);
  if (error) throw error;
}

export async function markAllContactMessagesRead(): Promise<void> {
  const { error } = await supabase.from('contact_messages').update({ read: true }).eq('read', false);
  if (error) throw error;
}
