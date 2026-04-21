import { createClient } from '@supabase/supabase-js';

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

  // ── 1. VERIFICACIÓN DE SESIÓN Y PLAN PRO ────────────────────────
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

  const { data: restaurante } = await supabaseAdmin
    .from('restaurantes')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();

  if (!restaurante || restaurante.plan !== 'pro') {
    return res.status(403).json({ error: 'Bloqueado: La importación mágica es una función exclusiva del plan Pro.' });
  }

  // ── 2. EXTRAER TEXTO DE LA URL ──────────────────────────────────
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta la URL' });

  let htmlText = "";
  try {
    const fetchUrl = url.startsWith('http') ? url : `https://${url}`;
    const htmlResponse = await fetch(fetchUrl);
    if (!htmlResponse.ok) throw new Error('No se pudo acceder a la web');
    const rawHtml = await htmlResponse.text();
    
    // Limpieza extrema para no ahogar a Claude
    htmlText = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 20000); 
  } catch (error) {
    return res.status(400).json({ error: 'No pudimos leer la URL. Comprueba que sea válida y pública.' });
  }

  // ── 3. ENVIAR A CLAUDE (NOMBRES + RECETAS ESTIMADAS) ─────────────
  const prompt = `Eres un Chef Ejecutivo experto en rentabilidad. He extraído este texto de la carta digital de mi restaurante:
  "${htmlText}"
  
  Tu tarea:
  1. Extrae TODOS los platos y sus precios de venta en carta.
  2. Para cada plato, genera su "escandallo" (receta) con los ingredientes principales, cantidades para 1 ración, unidad, precio estimado en España por KG o LITRO, y % de merma normal al limpiar/cocinar.

  Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
  [
    {
      "nombre_plato": "Entrecot a la parrilla",
      "categoria": "Principal",
      "precio_carta": 22.50,
      "ingredientes": [
        {"nombre": "Lomo de ternera", "cantidad": 300, "unidad": "g", "precio_kg": 18.50, "merma": 15},
        {"nombre": "Patata agria", "cantidad": 150, "unidad": "g", "precio_kg": 1.20, "merma": 20},
        {"nombre": "Aceite de oliva", "cantidad": 20, "unidad": "ml", "precio_kg": 8.00, "merma": 0}
      ]
    }
  ]
  Reglas: unidades solo "g", "ml", "ud". Mermas reales. No inventes platos que no estén en el texto. NO uses markdown, solo el JSON puro.`;

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error en IA');

    let raw_text = data.content?.[0]?.text || '[]';
    raw_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const platos = JSON.parse(raw_text);

    if (platos.length === 0) return res.status(400).json({ error: 'No encontramos platos en esa URL.' });

    // ── 4. CALCULAR MATEMÁTICAS EN EL SERVIDOR ────────────────────
    const insertData = platos.map(p => {
      let coste_total = 0;
      
      const ingredientesData = (p.ingredientes || []).map(ing => {
        let pUnidad = parseFloat(ing.precio_kg) || 0;
        // Si la unidad es g o ml, el precio guardado debe ser por gramo/ml para que la app lo lea bien
        if (ing.unidad === 'g' || ing.unidad === 'ml') pUnidad = pUnidad / 1000;
        
        let q = parseFloat(ing.cantidad) || 0;
        let m = parseFloat(ing.merma) || 0;
        
        let coste_ingrediente = (m > 0 ? q / (1 - m/100) : q) * pUnidad;
        coste_total += coste_ingrediente;

        return { nombre: ing.nombre, cantidad: q, unidad: ing.unidad, precio: pUnidad, merma: m };
      });

      const fc_pct = 30; // Default Food Cost
      const neto_pct = 20; // Default Margen Neto
      const precio_minimo = fc_pct > 0 ? coste_total / (fc_pct / 100) : 0;

      return {
        restaurante_id: restaurante.id,
        nombre_plato: p.nombre_plato,
        categoria: p.categoria || 'General',
        precio_carta: parseFloat(p.precio_carta) || 0,
        raciones: 1,
        ingredientes: ingredientesData,
        food_cost_pct: fc_pct,
        margen_neto_pct: neto_pct,
        coste_total: coste_total,
        coste_racion: coste_total, // raciones = 1
        precio_venta: precio_minimo, 
        updated_at: new Date().toISOString()
      };
    });

    // ── 5. GUARDAR TODO DE GOLPE ──────────────────────────────────
    const { error: insertError } = await supabaseAdmin.from('escandallos').insert(insertData);
    if (insertError) throw insertError;

    return res.status(200).json({ success: true, cantidad: platos.length });

  } catch (err) {
    console.error('import-menu error:', err.message);
    return res.status(500).json({ error: 'Error procesando el menú. ' + err.message });
  }
}
