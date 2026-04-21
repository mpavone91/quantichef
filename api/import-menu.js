import { createClient } from '@supabase/supabase-js';

// Cliente ANON para verificar la sesión
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cliente SERVICE ROLE para leer y escribir saltando RLS
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

  // ── 1. VERIFICACIÓN DE SESIÓN ───────────────────────────────────
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

  // ── 2. VERIFICAR QUE ES USUARIO PRO (CANDADO INHACKEABLE) ───────
  const { data: restaurante } = await supabaseAdmin
    .from('restaurantes')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();

  if (!restaurante) return res.status(403).json({ error: 'Restaurante no encontrado' });
  
  if (restaurante.plan !== 'pro') {
    return res.status(403).json({ error: 'Bloqueado: La importación de menú completo es una función exclusiva del plan Pro.' });
  }

  // ── 3. EXTRAER TEXTO DE LA URL ──────────────────────────────────
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta la URL' });

  let htmlText = "";
  try {
    // Añadimos https:// si el usuario olvidó ponerlo
    const fetchUrl = url.startsWith('http') ? url : `https://${url}`;
    const htmlResponse = await fetch(fetchUrl);
    if (!htmlResponse.ok) throw new Error('No se pudo acceder a la web');
    const rawHtml = await htmlResponse.text();
    
    // Limpieza básica para no saturar a la IA (quitamos scripts y tags HTML)
    htmlText = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 25000); // Límite seguro de caracteres para Claude
  } catch (error) {
    return res.status(400).json({ error: 'No pudimos leer la URL. Comprueba que sea correcta y pública.' });
  }

  // ── 4. ENVIAR A CLAUDE ──────────────────────────────────────────
  const prompt = `Eres un experto en extracción de datos de restaurantes. Aquí tienes el texto extraído de la carta digital de un restaurante:
  
  "${htmlText}"
  
  Extrae TODOS los platos y sus precios de venta. 
  Devuelve EXCLUSIVAMENTE un array JSON válido con este formato:
  [
    {"nombre_plato": "Ensaladilla Rusa", "categoria": "Entrante", "precio_carta": 12.50},
    {"nombre_plato": "Entrecot de Ternera", "categoria": "Principal", "precio_carta": 24.00}
  ]
  Si no encuentras platos, devuelve []. NO incluyas texto antes ni después del JSON. NO uses backticks ( \`\`\` ).`;

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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error en IA');

    let raw_text = data.content?.[0]?.text || '[]';
    raw_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const platos = JSON.parse(raw_text);

    if (platos.length === 0) {
      return res.status(400).json({ error: 'No encontramos platos en esa URL.' });
    }

    // ── 5. GUARDAR TODOS LOS PLATOS DE GOLPE EN SUPABASE ──────────
    const insertData = platos.map(p => ({
      restaurante_id: restaurante.id,
      nombre_plato: p.nombre_plato,
      categoria: p.categoria || 'General',
      precio_carta: parseFloat(p.precio_carta) || 0,
      raciones: 1,
      ingredientes: [], // Se guardan vacíos para que el usuario los calcule luego
      coste_total: 0,
      coste_racion: 0,
      precio_venta: 0
    }));

    const { error: insertError } = await supabaseAdmin.from('escandallos').insert(insertData);
    if (insertError) throw insertError;

    return res.status(200).json({ success: true, cantidad: platos.length });

  } catch (err) {
    console.error('import-menu error:', err.message);
    return res.status(500).json({ error: 'Error procesando el menú. Inténtalo de nuevo.' });
  }
}
