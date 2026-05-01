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
      .substring(0, 15000); 
  } catch (error) {
    return res.status(400).json({ error: 'No pudimos leer la URL. Comprueba que sea válida y pública.' });
  }

  // ── 3. ENVIAR A CLAUDE (NOMBRES + RECETAS ESTIMADAS + ALÉRGENOS) ──
  const prompt = `Eres un Chef Ejecutivo experto en rentabilidad. He extraído este texto de la carta digital de mi restaurante:
  "${htmlText}"
  
  Tu tarea:
  1. Extrae platos y sus precios de venta en carta.
  2. Para cada plato, genera su "escandallo" con 3 a 5 ingredientes principales, cantidades para 1 ración, unidad, precio estimado en España por KG o LITRO, y % de merma normal.
  3. Identifica los alérgenos presentes. SOLO puedes usar estos exactos: "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos", "Frutos secos", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos".

  REGLAS DE ORO:
  - NUNCA uses comillas dobles (") dentro de los textos. Usa simples (').
  - Devuelve EXCLUSIVAMENTE un JSON válido (array de objetos).
  - EXTRAE UN MÁXIMO DE 15 PLATOS PRINCIPALES. Esta regla es estricta para evitar cortes.

  FORMATO EXACTO:
  [
    {
      "nombre_plato": "Entrecot a la parrilla",
      "categoria": "Principal",
      "precio_carta": 22.50,
      "alergenos": ["Lácteos", "Sulfitos"],
      "ingredientes": [
        {"nombre": "Lomo de ternera", "cantidad": 300, "unidad": "g", "precio_kg": 18.50, "merma": 15},
        {"nombre": "Mantequilla", "cantidad": 20, "unidad": "g", "precio_kg": 6.00, "merma": 0}
      ]
    }
  ]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error en IA');

    let raw_text = data.content?.[0]?.text || '[]';
    raw_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // ── EL SALVAVIDAS AVANZADO ───────────────────────
    let platos = [];
    try {
      platos = JSON.parse(raw_text);
    } catch (parseError) {
      console.warn("JSON cortado. Intentando rescate avanzado...");
      try {
        const lastValidEnd = raw_text.lastIndexOf('}');
        if (lastValidEnd !== -1) {
          let rescuedText = raw_text.substring(0, lastValidEnd + 1);
          const firstBracket = rescuedText.indexOf('[');
          if (firstBracket !== -1) {
            rescuedText = rescuedText.substring(firstBracket);
          } else {
            rescuedText = '[' + rescuedText;
          }
          rescuedText += ']';
          platos = JSON.parse(rescuedText);
        } else {
          throw new Error('No se encontró estructura JSON recuperable.');
        }
      } catch (rescueErr) {
        throw new Error('La IA generó demasiados datos y se colapsó. Inténtalo de nuevo.');
      }
    }

    if (!Array.isArray(platos) || platos.length === 0) {
      return res.status(400).json({ error: 'No encontramos platos estructurados en esa URL.' });
    }

    // ── 4. CALCULAR MATEMÁTICAS EN EL SERVIDOR ────────────────────
    const insertData = platos.map(p => {
      let coste_total = 0;
      
      const ingredientesData = (p.ingredientes || []).map(ing => {
        let pUnidad = parseFloat(ing.precio_kg) || 0;
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
        nombre_plato: p.nombre_plato || 'Plato importado',
        categoria: p.categoria || 'General',
        precio_carta: parseFloat(p.precio_carta) || 0,
        raciones: 1,
        alergenos: Array.isArray(p.alergenos) ? p.alergenos : [], // Guardamos los alérgenos
        ingredientes: ingredientesData,
        food_cost_pct: fc_pct,
        margen_neto_pct: neto_pct,
        coste_total: coste_total,
        coste_racion: coste_total,
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
    return res.status(500).json({ error: err.message });
  }
}