// /api/campaign.js â€” Motor de campaÃ±a de email con tracking
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RESEND_KEY = process.env.RESEND_API_KEY;
const BASE_URL = 'https://www.quantichef.com';
// Fallback si ADMIN_SECRET_KEY no estÃ¡ configurada aÃºn en Vercel
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'qc-admin-2025';

// â”€â”€ HTML Email Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Email con diseÃ±o profesional usando tablas + CSS inline (compatible con Gmail/Outlook)

function emailWrapper(contenido, contactId) {
  const trackOpen = `${BASE_URL}/api/track?type=open&id=${contactId}`;
  const linkBaja  = `${BASE_URL}/api/track?type=unsub&id=${contactId}`;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F3;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F6F3">
<tr><td align="center" style="padding:32px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <!-- CABECERA CON LOGO -->
    <tr>
      <td bgcolor="#2D6A4F" style="background:#2D6A4F;border-radius:12px 12px 0 0;padding:24px 40px;text-align:left;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#C4943A;letter-spacing:-0.5px;">Quanti</span><span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;">Chef</span>
              <span style="display:block;font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;letter-spacing:1px;text-transform:uppercase;">Control de costes Â· F&amp;B</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CUERPO PRINCIPAL -->
    <tr>
      <td bgcolor="#ffffff" style="background:#ffffff;padding:36px 40px;border-left:1px solid #E5EDE8;border-right:1px solid #E5EDE8;">
        ${contenido}
      </td>
    </tr>

    <!-- PIE -->
    <tr>
      <td bgcolor="#F8FAF8" style="background:#F8FAF8;border:1px solid #E5EDE8;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:left;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;color:#8A9E8D;line-height:1.6;">
              <strong style="color:#5A7A5D;">Massimo</strong> Â· Founder, QuantiChef<br>
              <a href="mailto:hola@quantichef.com" style="color:#2D6A4F;text-decoration:none;">hola@quantichef.com</a> &nbsp;Â·&nbsp;
              <a href="https://www.quantichef.com" style="color:#2D6A4F;text-decoration:none;">www.quantichef.com</a>
            </td>
            <td align="right" style="font-size:11px;color:#B0BDB2;">
              <a href="${linkBaja}" style="color:#B0BDB2;text-decoration:underline;">Darme de baja</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ESPACIO FINAL -->
    <tr><td style="padding:16px;"></td></tr>
  </table>
</td></tr>
</table>
<img src="${trackOpen}" width="1" height="1" style="display:none" alt="">
</body>
</html>`;
}

// BotÃ³n CTA con tracking
function ctaButton(texto, url, contactId) {
  const tracked = `${BASE_URL}/api/track?type=click&id=${contactId}&dest=${encodeURIComponent(url)}`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
    <tr>
      <td bgcolor="#2D6A4F" style="background:#2D6A4F;border-radius:8px;padding:14px 28px;">
        <a href="${tracked}" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;white-space:nowrap;">${texto}</a>
      </td>
    </tr>
  </table>`;
}

function linkTexto(texto, url, contactId) {
  const tracked = `${BASE_URL}/api/track?type=click&id=${contactId}&dest=${encodeURIComponent(url)}`;
  return `<a href="${tracked}" style="color:#2D6A4F;font-weight:bold;text-decoration:none;">${texto} â†’</a>`;
}

// Caja de "social proof"
function socialProofBox(texto) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td bgcolor="#F0F7F3" style="background:#F0F7F3;border-left:3px solid #2D6A4F;border-radius:0 8px 8px 0;padding:14px 18px;">
        <span style="font-size:13px;color:#2D5C3F;line-height:1.6;font-style:italic;">${texto}</span>
      </td>
    </tr>
  </table>`;
}

// â”€â”€ Templates por segmento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getTemplate(segmento, contacto, customTemplates) {
  const nombre  = contacto.nombre  || 'Chef';
  const empresa = contacto.empresa || 'tu restaurante';
  const cargo   = contacto.cargo   || '';
  const id      = contacto.id;

  // Si hay template personalizado del editor, usarlo (con wrapper de diseÃ±o)
  const custom = customTemplates?.[segmento];
  if (custom?.asunto && custom?.html) {
    const asunto = custom.asunto
      .replace(/{nombre}/g, nombre).replace(/{empresa}/g, empresa).replace(/{cargo}/g, cargo);
    const cuerpo = custom.html
      .replace(/{nombre}/g, nombre).replace(/{empresa}/g, empresa).replace(/{cargo}/g, cargo);
    return { asunto, html: emailWrapper(wrapLinks(cuerpo, id), id) };
  }

  // â”€â”€ SEGMENTO A: PROPIETARIOS / OWNERS / CEOs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (segmento === 'A') {
    const asunto = `${nombre}, Â¿sabes exactamente cuÃ¡nto te cuesta cada plato?`;
    const cuerpo = `
      <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Hola <strong>${nombre}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">La mayorÃ­a de propietarios con los que hablo dicen lo mismo cuando empezamos:</p>
      ${socialProofBox('"SabÃ­a que mi food cost era alto, pero no exactamente en quÃ© plato lo estaba perdiendo."')}
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;"><strong style="color:#111;">QuantiChef</strong> resuelve eso. Subes la factura de tu proveedor (foto o PDF), la IA extrae los precios automÃ¡ticamente y recalcula el margen real de cada receta al instante.</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">Sin Excel. Sin estimaciones. Sin contratar a nadie mÃ¡s.</p>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:16px;">${ctaButton('Ver cÃ³mo funciona', BASE_URL, id)}</td>
          <td style="vertical-align:middle;font-size:14px;">${linkTexto('Pedir una demo de 15 min', 'https://www.quantichef.com/contacto.html', id)}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">3 dÃ­as gratis Â· Sin tarjeta de crÃ©dito Â· Cancela cuando quieras</p>`;
    return { asunto, html: emailWrapper(cuerpo, id) };
  }

  // â”€â”€ SEGMENTO B: F&B MANAGERS / JEFES DE OPERACIONES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (segmento === 'B') {
    const asunto = `Control de food cost automatizado â€” para equipos como el de ${empresa}`;
    const cuerpo = `
      <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Hola <strong>${nombre}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Gestionar el food cost cuando los precios de proveedor cambian cada semana es un trabajo constante. La mayorÃ­a de equipos lo hacen con Excel o directamente a ojo â€” y el margen se escapa sin que nadie lo vea venir.</p>
      ${socialProofBox('Equipos de GOIKO, Honest Greens y Grupo Tragaluz ya usan QuantiChef para actualizar sus escandallos automÃ¡ticamente cuando sube el aceite o cambia el proveedor de carne.')}
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;"><strong style="color:#111;">QuantiChef</strong> automatiza ese control: sube el albarÃ¡n del proveedor, la IA extrae los precios y actualiza el coste de cada plato en tiempo real.</p>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:16px;">${ctaButton('Ver la plataforma', BASE_URL, id)}</td>
          <td style="vertical-align:middle;font-size:14px;">${linkTexto('Agendar una llamada', 'https://www.quantichef.com/contacto.html', id)}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">Prueba gratuita 3 dÃ­as Â· Sin tarjeta Â· Setup en 5 minutos</p>`;
    return { asunto, html: emailWrapper(cuerpo, id) };
  }

  // â”€â”€ SEGMENTO D: LEADS EPACK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const asuntoD = `${nombre}, Â¿cuÃ¡nto te cuesta realmente cada plato?`;
  const cuerpoD = `
    <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Hola <strong>${nombre}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Nos ponemos en contacto desde <strong style="color:#111;">QuantiChef</strong> porque ${empresa ? 'vemos que en <strong>' + empresa + '</strong> ' : ''}trabajÃ¡is en hostelerÃ­a y creemos que podemos ayudaros a mejorar el control de costes.</p>
    ${socialProofBox('Restaurantes como Lina Restaurante, Grosso Napoletano y La Taqueria ya calculan el food cost real de cada plato automÃ¡ticamente â€” sin Excel, sin trabajo manual.')}
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">QuantiChef lee vuestras facturas de proveedor y actualiza el margen de cada receta en tiempo real. Setup en 5 minutos.</p>
    ${ctaButton('Ver cÃ³mo funciona', BASE_URL, id)}
    <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;">3 dÃ­as gratis Â· Sin tarjeta de crÃ©dito</p>`;
  if (segmento === 'D') return { asunto: asuntoD, html: emailWrapper(cuerpoD, id) };

  // â”€â”€ SEGMENTO C: OTROS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const asunto = `Â¿CuÃ¡nto os cuesta realmente cada plato en ${empresa}?`;
  const cuerpo = `
    <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Hola <strong>${nombre}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">La mayorÃ­a de negocios del sector hostelero calculan el food cost de forma aproximada â€” o directamente no lo calculan. <strong style="color:#111;">QuantiChef</strong> lo hace automÃ¡ticamente a partir de las facturas de proveedor.</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">Sin Excel, sin trabajo manual. El margen real de cada plato, actualizado en tiempo real.</p>
    ${ctaButton('Conocer QuantiChef', BASE_URL, id)}
    <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;">3 dÃ­as gratis Â· Sin tarjeta de crÃ©dito</p>`;
  return { asunto, html: emailWrapper(cuerpo, id) };
}

// Envuelve hrefs en links de tracking
function wrapLinks(html, contactId) {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    if (url.includes('/api/track')) return match;
    const tracked = `${BASE_URL}/api/track?type=click&id=${contactId}&dest=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { mode } = req.method === 'GET' ? req.query : (req.body || {});

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'stats') {
    const { data, error } = await sb.from('campana_contactos').select('estado, segmento');
    if (error) return res.status(500).json({ error: error.message });
    const stats = { total: 0, pendiente: 0, enviado: 0, abierto: 0, cliqueado: 0, respondio: 0, baja: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of data || []) {
      stats.total++;
      stats[r.estado] = (stats[r.estado] || 0) + 1;
      stats[r.segmento] = (stats[r.segmento] || 0) + 1;
    }
    return res.json(stats);
  }

  // â”€â”€ Lista de contactos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'list') {
    const { segmento, estado, page = 0, limit = 50 } = req.method === 'GET' ? req.query : (req.body || {});
    let q = sb.from('campana_contactos').select('*').order('segmento').order('created_at');
    if (segmento) q = q.eq('segmento', segmento);
    if (estado) q = q.eq('estado', estado);
    const p = parseInt(page), l = parseInt(limit);
    q = q.range(p * l, (p + 1) * l - 1);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ contactos: data });
  }

  // â”€â”€ Preview de email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'preview') {
    const { segmento = 'A', templates: customTemplates } = req.body || {};
    const mockContacto = { id: 'preview-id', nombre: 'Fernando', empresa: 'Restaurante Ejemplo', cargo: 'Propietario' };
    const template = getTemplate(segmento, mockContacto, customTemplates);
    return res.json({ asunto: template.asunto, html: template.html });
  }

  // â”€â”€ Enviar lote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'enviar_lote') {
    const { segmento, cantidad = 50, templates: customTemplates } = req.body || {};

    let q = sb.from('campana_contactos').select('*').eq('estado', 'pendiente').limit(parseInt(cantidad));
    if (segmento && segmento !== 'todos') q = q.eq('segmento', segmento);

    const { data: contactos, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    if (!contactos?.length) return res.json({ enviados: 0, mensaje: 'No hay contactos pendientes' });

    const resultados = [];
    for (const contacto of contactos) {
      try {
        const template = getTemplate(contacto.segmento, contacto, customTemplates);

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
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        resultados.push({ email: contacto.email, ok: false, error: e.message });
      }
    }

    return res.json({
      enviados: resultados.filter(r => r.ok).length,
      fallidos: resultados.filter(r => !r.ok).length,
      detalle: resultados
    });
  }

  return res.status(400).json({ error: 'Modo no reconocido' });
}

