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
      .substring(0, 20000); // Tope de seguridad
  } catch (error) {
    return res.status(400).json({ error: 'No pudimos leer la URL. Comprueba que sea válida y pública.' });
  }

  // ── 3. ENVIAR A CLAUDE (NOMBRES + RECETAS ESTIMADAS) ─────────────
  const prompt = `Eres un Chef Ejecutivo experto en rentabilidad. He extraído este texto de la carta digital de mi restaurante:
  "${htmlText}"
  
  Tu tarea:
  1. Extrae los platos y sus precios de venta en carta.
  2. Para cada plato, genera su "escandallo" con los 3 a 6 ingredientes principales, cantidades para 1 ración, unidad, precio estimado en España por KG o LITRO, y % de merma normal.

  REGLAS DE ORO (CRÍTICAS PARA EVITAR ERRORES DE SISTEMA):
  - NUNCA uses comillas dobles (") dentro de los textos. Usa comillas simples (') si es necesario. (Ej: 'Hamburguesa La Jefa').
  - Devuelve EXCLUSIVAMENTE un JSON válido que sea un array de objetos. NO escribas texto fuera del JSON.
  - Si la carta es inmensa, extrae solo un máximo de 35 platos para asegurar que el JSON no se corte a medias.

  FORMATO EXACTO:
  [
    {
      "nombre_plato": "Entrecot a la parrilla",
      "categoria": "Principal",
      "precio_carta": 22.50,
      "ingredientes": [
        {"nombre": "Lomo de ternera", "cantidad": 300, "unidad": "g", "precio_kg": 18.50, "merma": 15}
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096, // Máximo permitido
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error en IA');

    let raw_text = data.content?.[0]?.text || '[]';
    raw_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // ── EL SALVAVIDAS: PARSEO ROBUSTO DE JSON ───────────────────────
    let platos = [];
    try {
      platos = JSON.parse(raw_text);
    } catch (parseError) {
      console.warn("JSON cortado o malformado detectado. Intentando rescatar la estructura...");
      // Si se cortó el JSON al final, buscamos la última llave de objeto que cierra '}' y cerramos el array.
      const lastValidEnd = raw_text.lastIndexOf('}');
      if (lastValidEnd !== -1) {
        const rescuedText = raw_text.substring(0, lastValidEnd + 1) + ']';
        try {
          platos = JSON.parse(rescuedText);
          console.log(`¡Rescate exitoso! Salvamos ${platos.length} platos.`);
        } catch (rescueErr) {
          throw new Error('La IA generó caracteres incompatibles. Detalles: ' + parseError.message);
        }
      } else {
        throw new Error('Error crítico al procesar la receta: ' + parseError.message);
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
        nombre_plato: p.nombre_plato || 'Plato sin nombre',
        categoria: p.categoria || 'General',
        precio_carta: parseFloat(p.precio_carta) || 0,
        raciones: 1,
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
    return res.status(500).json({ error: 'Error procesando el menú. ' + err.message });
  }
}
