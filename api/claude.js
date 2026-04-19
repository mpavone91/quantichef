import { createClient } from '@supabase/supabase-js';

// Cliente ANON para verificar la sesión del usuario
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cliente SERVICE ROLE para leer restaurantes saltando RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida o caducada' });

  // ── VERIFICAR QUE TIENE RESTAURANTE ACTIVO (service role para saltar RLS) ──
  const { data: restaurante } = await supabaseAdmin
    .from('restaurantes')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();
  if (!restaurante) return res.status(403).json({ error: 'Sin acceso' });

  // ── RECIBIR SOLO DATOS, CONSTRUIR PROMPT EN EL SERVIDOR ──────
  const { plato, categoria, raciones } = req.body;
  if (!plato) return res.status(400).json({ error: 'Falta el nombre del plato' });

  const prompt = `Eres un chef profesional experto en costes de cocina en España. Para el plato "${plato}" (categoría: ${categoria || 'general'}, ${raciones || 1} raciones), dame ingredientes típicos con cantidades, precios y merma. Responde SOLO con un array JSON válido, sin texto adicional, sin markdown. Formato: [{"nombre":"Merluza fresca","cantidad":200,"unidad":"g","precio_kg":8.50,"merma":30}]. Unidades: g, kg, ml, l, ud. precio_kg = precio por kg o litro. merma = % pérdida al limpiar (0 si no hay). Máximo 10 ingredientes, cantidades útiles para ${raciones || 1} raciones. Precios hostelería España 2026.`;

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
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, JSON.stringify(data));
      return res.status(500).json({ error: data?.error?.message || `API error ${response.status}` });
    }

    // Extraer solo el texto — nunca exponer estructura interna de Anthropic
    const texto = data.content?.[0]?.text;
    if (!texto) return res.status(500).json({ error: 'Respuesta vacía de la IA' });

    return res.status(200).json({ content: [{ text: texto }] });

  } catch (err) {
    console.error('claude.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
