// /api/campaign.js — Motor de campaña de email con tracking
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RESEND_KEY = process.env.RESEND_API_KEY;
const BASE_URL = 'https://www.quantichef.com';

// ── Templates por segmento ────────────────────────────────────────────────────
function getTemplate(segmento, contacto) {
  const nombre = contacto.nombre;
  const empresa = contacto.empresa;
  const trackOpen = `${BASE_URL}/api/track?type=open&id=${contacto.id}&t=${Date.now()}`;
  const linkWeb = `${BASE_URL}/api/track?type=click&id=${contacto.id}&dest=${encodeURIComponent(BASE_URL)}`;
  const linkDemo = `${BASE_URL}/api/track?type=click&id=${contacto.id}&dest=${encodeURIComponent('https://cal.com/quantichef/demo')}`;
  const linkBaja = `${BASE_URL}/api/track?type=unsub&id=${contacto.id}`;

  const pixel = `<img src="${trackOpen}" width="1" height="1" style="display:none" alt="">`;

  if (segmento === 'A') {
    // PROPIETARIOS / OWNERS
    return {
      asunto: `${nombre}, ¿sabes exactamente cuánto te cuesta cada plato?`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;color:#222;line-height:1.6;font-size:15px;">
  <p>Hola ${nombre},</p>
  <p>En ${empresa} seguramente lo tienes más o menos controlado, pero hay algo que la mayoría de propietarios me dicen cuando empezamos a trabajar juntos: <strong>"sabía que el food cost era alto, pero no exactamente en qué plato".</strong></p>
  <p>QuantiChef lee tus facturas de proveedor y calcula el coste real de cada plato automáticamente. Restaurantes como <strong>Lina Restaurante, La Taqueria o Grosso Napoletano</strong> ya lo usan para proteger su margen sin tocar el menú.</p>
  <p>Sin Excel. Sin estimaciones. Sin contratar a nadie.</p>
  <p style="margin:24px 0;">
    <a href="${linkWeb}" style="background:#2D6A4F;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:10px;">Ver cómo funciona</a>
    <a href="${linkDemo}" style="color:#2D6A4F;font-weight:bold;">Pedir demo de 15 min →</a>
  </p>
  <p style="font-size:13px;color:#666;">3 días gratis, sin tarjeta de crédito.</p>
  <p>Un saludo,<br><strong>Massimo</strong><br>Founder, QuantiChef<br><a href="mailto:hola@quantichef.com" style="color:#2D6A4F;">hola@quantichef.com</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#aaa;">Recibiste este email porque tienes relación con el sector hostelero en España. Si no quieres recibir más emails, <a href="${linkBaja}" style="color:#aaa;">pulsa aquí para darte de baja</a>.</p>
  ${pixel}
</div>`
    };
  }

  if (segmento === 'B') {
    // F&B MANAGERS / JEFES DE OPERACIONES
    return {
      asunto: `Control de food cost en ${empresa} — sin Excel`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;color:#222;line-height:1.6;font-size:15px;">
  <p>Hola ${nombre},</p>
  <p>Gestionar el food cost en restaurantes con proveedores variables es un trabajo constante. La mayoría de equipos de operaciones que conozco lo hacen con Excel o directamente a ojo — y el margen se va sin que nadie lo vea venir.</p>
  <p>QuantiChef automatiza ese control: <strong>sube el albarán del proveedor (foto o PDF), la IA extrae los precios y actualiza el coste de cada plato en tiempo real.</strong> Equipos de operaciones de grupos como GOIKO, Honest Greens o Grupo Tragaluz ya trabajan así.</p>
  <p style="margin:24px 0;">
    <a href="${linkWeb}" style="background:#2D6A4F;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:10px;">Ver la plataforma</a>
    <a href="${linkDemo}" style="color:#2D6A4F;font-weight:bold;">Agendar una llamada →</a>
  </p>
  <p style="font-size:13px;color:#666;">Prueba gratuita 3 días · Sin tarjeta · Setup en 5 minutos</p>
  <p>Saludos,<br><strong>Massimo</strong><br>Founder, QuantiChef<br><a href="mailto:hola@quantichef.com" style="color:#2D6A4F;">hola@quantichef.com</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#aaa;">Si no quieres recibir más emails, <a href="${linkBaja}" style="color:#aaa;">pulsa aquí para darte de baja</a>.</p>
  ${pixel}
</div>`
    };
  }

  // SEGMENTO C — version genérica más corta
  return {
    asunto: `QuantiChef — control de food cost automatizado para tu negocio`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:560px;color:#222;line-height:1.6;font-size:15px;">
  <p>Hola ${nombre},</p>
  <p>¿Cuánto os cuesta realmente cada plato en ${empresa}? QuantiChef lee vuestras facturas de proveedor y calcula el food cost automáticamente — sin Excel, sin trabajo manual.</p>
  <p style="margin:24px 0;">
    <a href="${linkWeb}" style="background:#2D6A4F;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Conocer QuantiChef</a>
  </p>
  <p style="font-size:13px;color:#666;">3 días gratis, sin tarjeta.</p>
  <p>Saludos,<br><strong>Massimo</strong><br><a href="mailto:hola@quantichef.com" style="color:#2D6A4F;">hola@quantichef.com</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#aaa;"><a href="${linkBaja}" style="color:#aaa;">Darme de baja</a></p>
  ${pixel}
</div>`
  };
}

export default async function handler(req, res) {
  // Auth básica por header secreto (solo para uso interno)
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { mode } = req.method === 'GET' ? req.query : req.body;

  // ── Stats de campaña ─────────────────────────────────────────────────────
  if (mode === 'stats') {
    const { data } = await sb
      .from('campana_contactos')
      .select('estado, segmento');
    
    const stats = { total: 0, pendiente: 0, enviado: 0, abierto: 0, cliqueado: 0, respondio: 0, baja: 0, A: 0, B: 0, C: 0 };
    for (const r of data || []) {
      stats.total++;
      stats[r.estado] = (stats[r.estado] || 0) + 1;
      stats[r.segmento] = (stats[r.segmento] || 0) + 1;
    }
    return res.json(stats);
  }

  // ── Obtener lista de contactos ────────────────────────────────────────────
  if (mode === 'list') {
    const { segmento, estado, page = 0, limit = 50 } = req.method === 'GET' ? req.query : req.body;
    let q = sb.from('campana_contactos').select('*').order('segmento').order('created_at');
    if (segmento) q = q.eq('segmento', segmento);
    if (estado) q = q.eq('estado', estado);
    q = q.range(page * limit, (page + 1) * limit - 1);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ contactos: data });
  }

  // ── Enviar lote de emails ─────────────────────────────────────────────────
  if (mode === 'enviar_lote') {
    const { segmento, cantidad = 50 } = req.body;
    
    let q = sb.from('campana_contactos')
      .select('*')
      .eq('estado', 'pendiente')
      .limit(cantidad);
    if (segmento && segmento !== 'todos') q = q.eq('segmento', segmento);
    
    const { data: contactos, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    if (!contactos?.length) return res.json({ enviados: 0, mensaje: 'No hay contactos pendientes' });

    const resultados = [];
    for (const contacto of contactos) {
      try {
        const template = getTemplate(contacto.segmento, contacto);
        
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from: 'Massimo de QuantiChef <hola@quantichef.com>',
            to: contacto.email,
            subject: template.asunto,
            html: template.html
          })
        });

        if (resp.ok) {
          await sb.from('campana_contactos')
            .update({ estado: 'enviado', enviado_at: new Date().toISOString() })
            .eq('id', contacto.id);
          resultados.push({ email: contacto.email, ok: true });
        } else {
          const err = await resp.json();
          resultados.push({ email: contacto.email, ok: false, error: err.message });
        }
        // Pausa entre envíos para no activar anti-spam
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        resultados.push({ email: contacto.email, ok: false, error: e.message });
      }
    }

    const ok = resultados.filter(r => r.ok).length;
    const fail = resultados.filter(r => !r.ok).length;
    return res.json({ enviados: ok, fallidos: fail, detalle: resultados });
  }

  return res.status(400).json({ error: 'Modo no reconocido' });
}
