import { createClient } from '@supabase/supabase-js';

// Admin client para operaciones de datos
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Auth client para verificar el token del usuario
const sbAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function normalizarNombre(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Auth — usar el cliente ANON para verificar el token
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: { user }, error: authError } = await sbAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida o caducada' });

    // Restaurante — usar el cliente admin
    const { data: rest } = await sb.from('restaurantes').select('id').eq('user_id', user.id).maybeSingle();
    if (!rest) return res.status(404).json({ error: 'Restaurante no encontrado' });
    const restaurante_id = rest.id;

  // ── GET: listar despensa ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('despensa')
      .select('*')
      .eq('restaurante_id', restaurante_id)
      .order('nombre', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const valorTotal = (data || []).reduce((acc, i) =>
      acc + (i.cantidad_actual * i.precio_por_unidad), 0);
    const mermaTotal = (data || []).reduce((acc, i) =>
      acc + (i.merma_acumulada * i.precio_por_unidad), 0);

    return res.json({ items: data || [], valorTotal, mermaTotal });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { mode } = req.body;

  // ── POST mode=recibir_entrega: procesar albarán ──────────────────────
  if (mode === 'recibir_entrega') {
    const { file_base64, file_type } = req.body;
    if (!file_base64) return res.status(400).json({ error: 'Falta el archivo' });

    const typeLower = (file_type || '').toLowerCase();
    const isText = ['csv', 'txt'].includes(typeLower);

    let contentBlock;
    if (isText) {
      const texto = Buffer.from(file_base64, 'base64').toString('utf-8');
      contentBlock = { type: 'text', text: `DATOS DEL ALBARÁN:\n${texto}` };
    } else if (typeLower === 'pdf') {
      contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } };
    } else {
      const mime = typeLower === 'png' ? 'image/png' : typeLower === 'webp' ? 'image/webp' : 'image/jpeg';
      contentBlock = { type: 'image', source: { type: 'base64', media_type: mime, data: file_base64 } };
    }

    const prompt = `Eres un asistente de cocina profesional. Analiza este albarán/factura de proveedor y extrae TODOS los productos.

Por cada producto devuelve:
- "nombre": nombre del ingrediente tal como aparece
- "cantidad": cantidad recibida (número)
- "unidad": unidad de medida — usa solo: kg, g, l, ml, ud
- "precio": precio por unidad (€/kg, €/l, €/ud) — solo el número

REGLAS:
- Si el precio es por 100g, conviértelo a €/kg multiplicando por 10
- Si no aparece cantidad, pon 0
- Si no aparece precio, pon 0
- Devuelve SOLO JSON válido sin texto adicional:

{"productos":[{"nombre":"Harina de trigo","cantidad":25,"unidad":"kg","precio":0.85}]}`;

    const messageContent = contentBlock.type === 'text'
      ? [{ type: 'text', text: contentBlock.text + '\n\n' + prompt }]
      : [contentBlock, { type: 'text', text: prompt }];

    try {
      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          temperature: 0,
          messages: [{ role: 'user', content: messageContent }]
        })
      });

      if (!aiResp.ok) {
        const errData = await aiResp.json();
        return res.status(500).json({ error: 'Error de IA: ' + (errData.error?.message || aiResp.status) });
      }

      const aiData = await aiResp.json();
      const raw = aiData.content?.[0]?.text || '';
      const first = raw.indexOf('{');
      const last = raw.lastIndexOf('}');
      if (first === -1) return res.status(422).json({ error: 'La IA no pudo leer el documento' });

      const parsed = JSON.parse(raw.substring(first, last + 1));
      return res.json({ success: true, productos: parsed.productos || [] });

    } catch (err) {
      return res.status(500).json({ error: 'Error de IA: ' + err.message });
    }
  }

  // ── POST mode=confirmar_entrega: guardar albarán en despensa ─────────
  if (mode === 'confirmar_entrega') {
    const { productos } = req.body;
    if (!productos?.length) return res.status(400).json({ error: 'Sin productos' });

    let guardados = 0, errores = [];

    for (const p of productos) {
      if (!p.nombre) continue;
      const norm = normalizarNombre(p.nombre);
      const cantidad = parseFloat(p.cantidad) || 0;
      const precio = parseFloat(p.precio) || 0;

      const { data: existing } = await sb
        .from('despensa')
        .select('id, cantidad_actual')
        .eq('restaurante_id', restaurante_id)
        .eq('nombre_normalizado', norm)
        .maybeSingle();

      if (existing) {
        const { error } = await sb.from('despensa').update({
          cantidad_actual: existing.cantidad_actual + cantidad,
          precio_por_unidad: precio > 0 ? precio : undefined,
          unidad: p.unidad || 'kg',
          ultima_actualizacion: new Date().toISOString()
        }).eq('id', existing.id);
        if (error) errores.push(p.nombre);
        else guardados++;
      } else {
        const { error } = await sb.from('despensa').insert({
          restaurante_id,
          nombre: p.nombre,
          nombre_normalizado: norm,
          cantidad_actual: cantidad,
          precio_por_unidad: precio,
          unidad: p.unidad || 'kg'
        });
        if (error) errores.push(p.nombre);
        else guardados++;
      }
    }

    return res.json({ success: true, guardados, errores });
  }

  // ── POST mode=registrar_merma: anotar pérdida ────────────────────────
  if (mode === 'registrar_merma') {
    const { nombre_normalizado, cantidad_merma, motivo } = req.body;
    if (!nombre_normalizado || !cantidad_merma) return res.status(400).json({ error: 'Datos incompletos' });

    const { data: item } = await sb
      .from('despensa')
      .select('id, cantidad_actual, merma_acumulada')
      .eq('restaurante_id', restaurante_id)
      .eq('nombre_normalizado', nombre_normalizado)
      .maybeSingle();

    if (!item) return res.status(404).json({ error: 'Ingrediente no encontrado' });

    const nuevaCantidad = Math.max(0, item.cantidad_actual - parseFloat(cantidad_merma));
    const nuevaMerma = (item.merma_acumulada || 0) + parseFloat(cantidad_merma);

    const { error } = await sb.from('despensa').update({
      cantidad_actual: nuevaCantidad,
      merma_acumulada: nuevaMerma,
      ultima_actualizacion: new Date().toISOString()
    }).eq('id', item.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, cantidad_restante: nuevaCantidad });
  }

  // ── POST mode=ajuste_manual: editar cantidad o precio ───────────────
  if (mode === 'ajuste_manual') {
    const { id, cantidad_actual, precio_por_unidad, stock_minimo } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta el id' });

    const updates = { ultima_actualizacion: new Date().toISOString() };
    if (cantidad_actual !== undefined) updates.cantidad_actual = parseFloat(cantidad_actual);
    if (precio_por_unidad !== undefined) updates.precio_por_unidad = parseFloat(precio_por_unidad);
    if (stock_minimo !== undefined) updates.stock_minimo = parseFloat(stock_minimo);

    const { error } = await sb.from('despensa').update(updates)
      .eq('id', id).eq('restaurante_id', restaurante_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  // ── POST mode=descontar_ventas: TPV → descuento por escandallos ──────
  if (mode === 'descontar_ventas') {
    const { ventas } = req.body; // [{nombre_plato, raciones}]
    if (!ventas?.length) return res.status(400).json({ error: 'Sin ventas' });

    const { data: escandallos } = await sb
      .from('escandallos')
      .select('nombre_plato, ingredientes, raciones')
      .eq('restaurante_id', restaurante_id);

    const { data: despensa } = await sb
      .from('despensa')
      .select('id, nombre_normalizado, cantidad_actual, unidad')
      .eq('restaurante_id', restaurante_id);

    let descontados = [], sinMapear = [], errores = [];

    for (const venta of ventas) {
      const normPlato = normalizarNombre(venta.nombre_plato);
      const esc = escandallos?.find(e => normalizarNombre(e.nombre_plato) === normPlato);

      if (!esc) {
        sinMapear.push(venta.nombre_plato);
        continue;
      }

      const racWendidas = parseFloat(venta.raciones) || 1;
      const racReceta = parseFloat(esc.raciones) || 1;
      const ingredientes = typeof esc.ingredientes === 'string'
        ? JSON.parse(esc.ingredientes) : esc.ingredientes || [];

      for (const ing of ingredientes) {
        const normIng = normalizarNombre(ing.n || ing.nombre || '');
        const item = despensa?.find(d => d.nombre_normalizado === normIng);
        if (!item) { sinMapear.push(ing.n); continue; }

        // Convertir gramos a la unidad del stock
        let cantDesc = (parseFloat(ing.q || 0) / racReceta) * racWendidas;
        if ((ing.u === 'g' || ing.u === 'gr') && item.unidad === 'kg') cantDesc /= 1000;
        if ((ing.u === 'ml') && item.unidad === 'l') cantDesc /= 1000;

        const nuevaCant = Math.max(0, item.cantidad_actual - cantDesc);
        const { error } = await sb.from('despensa').update({
          cantidad_actual: nuevaCant,
          ultima_actualizacion: new Date().toISOString()
        }).eq('id', item.id);

        if (error) errores.push(ing.n);
        else descontados.push({ ingrediente: ing.n, cantidad: cantDesc, unidad: item.unidad });
      }
    }

    return res.json({ success: true, descontados, sinMapear, errores });
  }

  return res.status(400).json({ error: 'Modo desconocido: ' + mode });

  } catch (err) {
    console.error('[despensa] Error inesperado:', err);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}
