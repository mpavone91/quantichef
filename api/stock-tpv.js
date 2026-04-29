import { createClient } from '@supabase/supabase-js';

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

  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida o caducada' });

  const { file_base64, file_type } = req.body;
  if (!file_base64 || !file_type) return res.status(400).json({ error: 'Falta el archivo' });

  const ext = file_type.toLowerCase();

  let content_block;
  if (ext === 'pdf') {
    content_block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } };
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    content_block = { type: 'image', source: { type: 'base64', media_type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, data: file_base64 } };
  } else {
    return res.status(400).json({ error: 'Formato no soportado. Usa PDF, PNG, JPG o WEBP.' });
  }

  const prompt = `Eres un asistente experto en hostelería española. Analiza este ticket o informe de ventas de un TPV (Terminal Punto de Venta) y extrae todos los platos vendidos con sus cantidades.

Para cada línea de venta devuelve:
- nombre_plato: el nombre del plato tal como aparece en el ticket
- raciones: el número de unidades/raciones vendidas (número entero)

Ignora bebidas, postres genéricos, servicios, cargos, propinas y totales.
Si un plato aparece varias veces, súmalo en una sola entrada.
Si no puedes determinar la cantidad, pon 1.

Responde SOLO con un JSON válido, sin markdown, sin backticks:
{
  "fecha": "YYYY-MM-DD o null",
  "ventas": [
    { "nombre_plato": "Nombre del plato", "raciones": 3 }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [content_block, { type: 'text', text: prompt }]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error de la API' });

    const raw = data.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(422).json({ error: 'No se pudo interpretar la respuesta. Asegúrate de subir un ticket de ventas legible.' });

    const parsed = JSON.parse(match[0]);
    if (!parsed.ventas || !Array.isArray(parsed.ventas)) {
      return res.status(422).json({ error: 'No se detectaron platos vendidos en el documento.' });
    }

    return res.status(200).json({ ventas: parsed.ventas, fecha: parsed.fecha || null });
  } catch (err) {
    console.error('stock-tpv error:', err);
    return res.status(500).json({ error: 'Error procesando el ticket. Inténtalo de nuevo.' });
  }
}
