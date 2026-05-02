// /api/track.js — Tracking de aperturas, clicks y bajas
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Pixel transparente 1x1
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export default async function handler(req, res) {
  const { type, id, dest } = req.query;

  if (!id) return res.status(400).end();

  if (type === 'open') {
    // Registrar apertura
    await sb.from('campana_contactos')
      .update({ estado: 'abierto', abierto_at: new Date().toISOString() })
      .eq('id', id)
      .in('estado', ['enviado']); // Solo actualizar si no ha hecho algo más

    // Devolver pixel transparente
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache');
    return res.send(PIXEL);
  }

  if (type === 'click') {
    // Registrar clic
    await sb.from('campana_contactos')
      .update({ 
        estado: 'cliqueado', 
        cliqueado_at: new Date().toISOString(),
        url_clicada: dest || ''
      })
      .eq('id', id);

    // Redirigir al destino
    return res.redirect(302, decodeURIComponent(dest || 'https://www.quantichef.com'));
  }

  if (type === 'unsub') {
    // Dar de baja
    await sb.from('campana_contactos')
      .update({ estado: 'baja', baja_at: new Date().toISOString() })
      .eq('id', id);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Baja confirmada</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px;color:#374151;">
  <h1 style="color:#2D6A4F;">✓ Te hemos dado de baja</h1>
  <p>No volverás a recibir emails de QuantiChef.</p>
  <p style="font-size:13px;color:#9CA3AF;">Si fue un error, escríbenos a <a href="mailto:hola@quantichef.com">hola@quantichef.com</a></p>
</body></html>`);
  }

  return res.status(400).end();
}
