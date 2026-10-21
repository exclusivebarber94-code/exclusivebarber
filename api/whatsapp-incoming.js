// Respuesta automática cuando un cliente le escribe al número de avisos (Twilio → WhatsApp sender →
// «Webhook URL for incoming messages»). Ese número no está en ningún celular: se le indica al cliente
// el WhatsApp de la barbería. Como el cliente escribió primero, la respuesta no necesita plantilla.

const REPLY =
  'Hola 👋 Este número de Exclusive Barber solo envía avisos automáticos y no recibe mensajes.\n\n' +
  'Para cambiar o cancelar tu cita, o para cualquier pregunta, escríbenos al WhatsApp 314 411 0530:\n' +
  'https://wa.me/573144110530\n\n¡Gracias!';

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(REPLY)}</Message></Response>`);
}
