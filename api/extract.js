import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { file_base64, file_type, file_name, mode } = req.body;

    // ── MODO GUARDAR PRECIOS ─────────────────────────────────────
    if (mode === 'save_prices') {
      const { productos, restaurante_id } = req.body;
      if (!productos || !restaurante_id) {
        return res.status(400).json({ error: 'Faltan datos para guardar' });
      }
      const result = await guardarYCompararPrecios(productos, restaurante_id);
      return res.status(200).json(result);
    }

    // ── MODO EXTRACCIÓN ──────────────────────────────────────────
    if (!file_base64 || !file_type) {
      return res.status(400).json({ error: 'Falta el archivo o el tipo' });
    }

    let content_block;
    const ext = file_type.toLowerCase();

    if (ext === 'pdf') {
      content_block = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file_base64 }
      };
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      content_block = {
        type: 'image',
        source: { type: 'base64', media_type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, data: file_base64 }
      };
    } else if (['csv', 'xlsx', 'xls', 'txt'].includes(ext)) {
      const text_content = Buffer.from(file_base64, 'base64').toString('utf-8');
      content_block = {
        type: 'text',
        text: `Contenido del archivo ${file_name}:\n\n${text_content}`
      };
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usa PDF, imagen, CSV o Excel.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            content_block,
            {
              type: 'text',
              text: `Eres un asistente experto en hostelería española. Analiza este documento de proveedor (albarán, factura, lista de precios o catálogo) y extrae TODOS los productos alimentarios con sus precios.

Para cada producto, devuelve:
- nombre: el nombre del producto tal como aparece
- ingrediente_normalizado: nombre simplificado y genérico en minúsculas, sin tildes, sin marcas comerciales (ej: "PECHUGA POLLO FRESCA CAT.A" → "pechuga de pollo")
- precio: el precio numérico (solo el número, sin símbolo €)
- unidad: la unidad de medida (kg, l, ud, caja, docena, etc.)
- proveedor: el nombre del proveedor si aparece en el documento

IMPORTANTE:
- Si el precio es por caja/bolsa, calcula el precio por kg o por unidad si hay información suficiente
- Si no puedes determinar la unidad, pon "ud"
- Ignora productos no alimentarios (limpieza, envases, etc.)
- Si hay varios precios (con/sin IVA), usa el precio SIN IVA

Responde SOLO con un JSON válido, sin markdown, sin backticks:
{
  "proveedor": "Nombre del proveedor",
  "fecha_documento": "YYYY-MM-DD o null si no aparece",
  "productos": [
    {
      "nombre": "nombre original",
      "ingrediente_normalizado": "nombre simplificado",
      "precio": 0.00,
      "unidad": "kg"
    }
  ]
}`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error de la API' });
    }

    const raw_text = data.content?.[0]?.text || '';
    const clean_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean_text);
    } catch {
      return res.status(200).json({
        error: 'No se pudo interpretar el documento. Asegúrate de que es un albarán o lista de precios legible.',
        raw: raw_text
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── LÓGICA DE COMPARACIÓN Y ALERTAS (ANTI-DUPLICADOS) ──────────────────────────
async function guardarYCompararPrecios(productos, restaurante_id) {
  const alertasGeneradas = [];
  const preciosActualizados = [];
  const preciosNuevos = [];

  // 1. DEDUPLICAR PRODUCTOS DEL ALBARÁN (El muro de contención)
  const productosUnicosMap = new Map();
  for (const p of productos) {
    const nombre_norm = normalizar(p.ingrediente_normalizado || p.nombre);
    // Al usar Map, si hay otro producto con el mismo nombre_norm, lo sobreescribe. Nos quedamos solo con uno.
    productosUnicosMap.set(nombre_norm, p);
  }
  const productosUnicos = Array.from(productosUnicosMap.values());

  for (const producto of productosUnicos) {
    const nombre_norm = normalizar(producto.ingrediente_normalizado || producto.nombre);
    const precio_nuevo = parseFloat(producto.precio) || 0;

    // 2. BUSCAR PRECIO ANTERIOR (Usando limit(1) para que no explote si ya tienes duplicados guardados de antes)
    const { data: anteriores } = await supabase
      .from('precios_proveedor')
      .select('*')
      .eq('restaurante_id', restaurante_id)
      .eq('ingrediente_normalizado', nombre_norm)
      .limit(1);

    const anterior = anteriores && anteriores.length > 0 ? anteriores[0] : null;

    if (anterior && parseFloat(anterior.precio_kg) !== precio_nuevo) {
      const precio_anterior = parseFloat(anterior.precio_kg);

      // Buscar escandallos afectados
      const { data: escandallos } = await supabase
        .from('escandallos')
        .select('id, nombre_plato, ingredientes, coste_racion, raciones')
        .eq('restaurante_id', restaurante_id);

      if (escandallos) {
        for (const esc of escandallos) {
          const ingredientes = esc.ingredientes || [];
          const ingAfectado = ingredientes.find(ing => {
            const ingNorm = normalizar(ing.nombre || '');
            return ingNorm === nombre_norm ||
                   ingNorm.includes(nombre_norm) ||
                   nombre_norm.includes(ingNorm);
          });

          if (ingAfectado) {
            const cantidad = parseFloat(ingAfectado.cantidad) || 0;
            const unidad = ingAfectado.unidad || 'g';
            const merma = parseFloat(ingAfectado.merma) || 0;

            // Convertir a kg/l
            let cantidadKg = cantidad;
            if (unidad === 'g' || unidad === 'ml') cantidadKg = cantidad / 1000;

            // Coste de los otros ingredientes (sin cambios)
            const costes_otros = ingredientes
              .filter(ing => normalizar(ing.nombre || '') !== nombre_norm)
              .reduce((sum, ing) => {
                const q = parseFloat(ing.cantidad) || 0;
                const p = parseFloat(ing.precio) || 0;
                const m = parseFloat(ing.merma) || 0;
                const qKg = (ing.unidad === 'g' || ing.unidad === 'ml') ? q / 1000 : q;
                return sum + (m > 0 ? qKg / (1 - m / 100) : qKg) * p;
              }, 0);

            const factor = merma > 0 ? cantidadKg / (1 - merma / 100) : cantidadKg;
            const costeIngAnterior = factor * precio_anterior;
            const costeIngNuevo = factor * precio_nuevo;

            const raciones = Math.max(parseInt(esc.raciones) || 1, 1);
            const coste_racion_anterior = (costes_otros + costeIngAnterior) / raciones;
            const coste_racion_nuevo = (costes_otros + costeIngNuevo) / raciones;

            alertasGeneradas.push({
              restaurante_id,
              escandallo_id: esc.id,
              escandallo_nombre: esc.nombre_plato,
              ingrediente: producto.ingrediente_normalizado || producto.nombre,
              precio_anterior,
              precio_nuevo,
              coste_racion_anterior: Math.round(coste_racion_anterior * 100) / 100,
              coste_racion_nuevo: Math.round(coste_racion_nuevo * 100) / 100,
              vista: false
            });
          }
        }
      }

      preciosActualizados.push(nombre_norm);
    } else if (!anterior) {
      preciosNuevos.push(nombre_norm);
    }

    // 3. ACTUALIZAR O INSERTAR
    const row = {
      restaurante_id,
      ingrediente: producto.nombre,
      ingrediente_normalizado: nombre_norm,
      precio_kg: precio_nuevo,
      unidad: producto.unidad || 'kg',
      proveedor: producto.proveedor || null,
      fecha_documento: producto.fecha_documento || null,
      updated_at: new Date().toISOString()
    };

    if (anterior) {
      await supabase.from('precios_proveedor').update(row).eq('id', anterior.id);
    } else {
      await supabase.from('precios_proveedor').insert(row);
    }
  }

  // Insertar todas las alertas de golpe
  if (alertasGeneradas.length > 0) {
    await supabase.from('alertas_precio').insert(alertasGeneradas);
  }

  return {
    ok: true,
    precios_actualizados: preciosActualizados.length,
    precios_nuevos: preciosNuevos.length,
    alertas_generadas: alertasGeneradas.length,
    alertas: alertasGeneradas
  };
}

function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
