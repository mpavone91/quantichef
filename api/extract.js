import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cliente ANON para verificar sesión
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── VERIFICACIÓN DE SESIÓN ───────────────────────────────────
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Sesión inválida o caducada' });
  }

  // ── OBTENCIÓN DEL RESTAURANTE ──────────────────────────────────
  // Utilizamos supabase (admin client) para obtener los datos del restaurante
  const { data: rest } = await supabase.from('restaurantes').select('id, plan, documentos_subidos').eq('user_id', user.id).single();
  
  if (!rest) {
    return res.status(403).json({ error: 'Restaurante no encontrado' });
  }

  try {
    const { file_base64, file_type, file_name, mode, productos, restaurante_id } = req.body;

    // ── MODO GUARDAR PRECIOS ─────────────────────────────────────
    if (mode === 'save_prices') {
      if (!productos || !restaurante_id) {
        return res.status(400).json({ error: 'Faltan datos para guardar' });
      }
      const result = await guardarYCompararPrecios(productos, restaurante_id);
      return res.status(200).json(result);
    }

    // ── VERIFICACIÓN DE LÍMITES PARA EXTRACCIÓN ───────────────────
    const limit = rest.plan === 'pro' ? 150 : 50;
    const docsSubidos = rest.documentos_subidos || 0;

    if (docsSubidos >= limit) {
      return res.status(403).json({ error: `Has alcanzado el límite de documentos (${limit}). Por favor, actualiza tu plan.` });
    }

    // ── MODO EXTRACCIÓN (FACTURAS O ETIQUETAS) ───────────────────
    if (!file_base64 || !file_type) {
      return res.status(400).json({ error: 'Falta el archivo o el tipo' });
    }

    let ext = file_type.toLowerCase();
    let isLabelScan = false;

    // Detectamos si la foto viene del Escandallo (Cámara)
    if (ext === 'label_scan') {
      isLabelScan = true;
      ext = 'jpeg'; // Asumimos que la cámara manda una foto JPEG
    }

    let content_block;

    // Preparar la imagen/documento para Anthropic
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
      return res.status(400).json({ error: 'Formato no soportado.' });
    }

    // Seleccionamos el Prompt según de dónde venga la foto
    let promptDinamico = "";

    if (isLabelScan) {
      // PROMPT PARA ESCANEAR RECETAS / ETIQUETAS (Desde el escandallo)
      promptDinamico = `Eres un asistente experto para chefs profesionales. 
      Te voy a pasar una foto de una receta escrita, una etiqueta de un producto o una ficha técnica. 
      Tu trabajo es:
      1. Extraer los ingredientes con su cantidad y unidad. (Si no hay cantidad, pon 0 y unidad "ud").
      2. Detectar los alérgenos presentes. Opciones válidas estrictas: "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos", "Frutos secos", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos".
      
      Devuelve ÚNICAMENTE un JSON válido con esta estructura estricta y sin texto fuera del JSON:
      {
        "ingredientes": [
          { "nombre": "Harina de trigo", "cantidad": 500, "unidad": "g" }
        ],
        "alergenos": ["Gluten"]
      }`;
    } else {
      // PROMPT ORIGINAL PARA FACTURAS (Desde el Dashboard)
      promptDinamico = `Eres un asistente experto en hostelería española. Analiza este documento de proveedor (albarán, factura, lista de precios o catálogo) y extrae TODOS los productos alimentarios con sus precios.

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
      }`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            content_block,
            {
              type: 'text',
              text: promptDinamico
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
    } catch (e) {
      return res.status(200).json({
        error: 'No se pudo interpretar el documento. Asegúrate de que es un albarán, receta o etiqueta legible.',
        raw: raw_text
      });
    }
    // Incrementar contador si todo fue bien (y no es un error de formato de Anthropic)
    await supabase.from('restaurantes').update({ documentos_subidos: docsSubidos + 1 }).eq('id', rest.id);

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
            if (!ingNorm || ingNorm.length < 4) return false;
            // 1. Coincidencia exacta (mejor caso)
            if (ingNorm === nombre_norm) return true;
            // 2. Match por palabras completas: todas las palabras del ingrediente del escandallo
            //    deben aparecer en el nombre normalizado del proveedor, o viceversa
            const palabrasIng = ingNorm.split(' ').filter(p => p.length >= 4);
            const palabrasNorm = nombre_norm.split(' ').filter(p => p.length >= 4);
            if (palabrasIng.length === 0 || palabrasNorm.length === 0) return false;
            // El ingrediente del escandallo debe tener todas sus palabras clave en el nombre del proveedor
            const matchForward = palabrasIng.every(p => nombre_norm.includes(p));
            // O el nombre del proveedor debe tener todas sus palabras clave en el del escandallo
            const matchBackward = palabrasNorm.every(p => ingNorm.includes(p));
            return matchForward || matchBackward;
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
