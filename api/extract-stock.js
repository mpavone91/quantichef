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

    // ── ESTE ENDPOINT SOLO EXTRAE, NO GUARDA EN BD. LA BD SE ACTUALIZA DESDE EL CLIENTE TRAS LA VERIFICACIÓN ──

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
      // PROMPT PARA ALBARANES / LISTAS DE STOCK (Desde el Dashboard - Inventario)
      promptDinamico = `Eres un asistente experto en logística de restaurantes. Analiza este documento (lista de inventario, albarán de entrega o recuento de stock) y extrae TODOS los productos alimentarios con sus cantidades y unidades actuales.

      Para cada producto, devuelve:
      - nombre: el nombre del producto tal como aparece
      - ingrediente_normalizado: nombre simplificado y genérico en minúsculas, sin tildes, sin marcas comerciales (ej: "PECHUGA POLLO FRESCA CAT.A" → "pechuga de pollo")
      - cantidad: la cantidad numérica total recibida o contada (ej: si dice "3 cajas de 5kg", la cantidad es 15)
      - unidad: la unidad de medida resultante (kg, l, ud). Usa siempre 'kg', 'l' o 'ud'.

      IMPORTANTE:
      - Si no puedes determinar la cantidad, pon 0.
      - Si no puedes determinar la unidad, asume 'ud'.
      - Ignora productos no alimentarios (limpieza, envases, etc.)

      Responde SOLO con un JSON válido, sin markdown, sin backticks:
      {
        "items": [
          {
            "nombre": "nombre original",
            "ingrediente_normalizado": "nombre simplificado",
            "cantidad": 15.5,
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
        model: 'claude-haiku-4-5-20251001', // He puesto el modelo real de Haiku para evitar fallos de API
        max_tokens: 4096,
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
    } catch {
      return res.status(200).json({
        error: 'No se pudo interpretar el documento. Asegúrate de que es un albarán, receta o etiqueta legible.',
        raw: raw_text
      });
    // Incrementar contador si todo fue bien (y no es un error de formato de Anthropic)
    await supabase.from('restaurantes').update({ documentos_subidos: docsSubidos + 1 }).eq('id', rest.id);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

