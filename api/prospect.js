import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Solo accesible para admins (comprobamos sesión)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  ).auth.getUser(token);

  if (authError || !user) return res.status(401).json({ error: 'No autorizado' });

  const { mode } = req.body || req.query;

  // ── GET LEADS guardados ───────────────────────────────────────────────
  if (req.method === 'GET' || mode === 'get_leads') {
    const { data, error } = await supabase
      .from('leads_prospeccion')
      .select('*')
      .order('score', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ leads: data || [] });
  }

  if (req.method !== 'POST') return res.status(405).end();

  // ── BUSCAR restaurantes via Yelp ──────────────────────────────────────
  if (mode === 'buscar') {
    const { ciudad, tipo_cocina = 'restaurants', limite = 20 } = req.body;
    if (!ciudad) return res.status(400).json({ error: 'Falta la ciudad' });

    const params = new URLSearchParams({
      location: ciudad,
      categories: tipo_cocina === 'todos' ? 'restaurants' : tipo_cocina,
      limit: Math.min(limite, 50),
      sort_by: 'rating',
      locale: 'es_ES'
    });

    const yelpResp = await fetch(
      `https://api.yelp.com/v3/businesses/search?${params}`,
      { headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` } }
    );

    if (!yelpResp.ok) {
      const err = await yelpResp.json();
      return res.status(500).json({ error: 'Error Yelp: ' + (err.error?.description || yelpResp.status) });
    }

    const yelpData = await yelpResp.json();
    const restaurantes = (yelpData.businesses || []).map(b => ({
      yelp_id: b.id,
      nombre: b.name,
      direccion: b.location?.display_address?.join(', ') || '',
      ciudad: b.location?.city || ciudad,
      telefono: b.phone || '',
      url_yelp: b.url || '',
      url_web: b.url || '',
      rating: b.rating || 0,
      num_reviews: b.review_count || 0,
      categorias: (b.categories || []).map(c => c.title).join(', '),
      imagen: b.image_url || '',
      precio: b.price || '',
      score: null,
      email_outreach: null,
      estado: 'nuevo'
    }));

    return res.json({ restaurantes, total: yelpData.total });
  }

  // ── CUALIFICAR + generar outreach con Claude ──────────────────────────
  if (mode === 'cualificar') {
    const { restaurante } = req.body;
    if (!restaurante) return res.status(400).json({ error: 'Falta el restaurante' });

    const prompt = `Eres un experto en ventas B2B para restaurantes. Analiza este restaurante y haz dos cosas:

RESTAURANTE:
- Nombre: ${restaurante.nombre}
- Ciudad: ${restaurante.ciudad}
- Tipo de cocina: ${restaurante.categorias}
- Rating: ${restaurante.rating}/5 (${restaurante.num_reviews} reseñas)
- Precio: ${restaurante.precio || 'desconocido'}
- Dirección: ${restaurante.direccion}

TAREA 1 - PUNTUACIÓN (1-10):
Puntúa la probabilidad de que este restaurante necesite QuantiChef (software de control de food cost y escandallo). Ten en cuenta:
- Restaurantes medianos (no cadenas, no demasiado pequeños) puntúan más alto
- Mayor número de reseñas = más actividad = más necesidad de control de costes
- Precio medio-alto = más margen que proteger = más interés

TAREA 2 - EMAIL DE PROSPECCIÓN:
Escribe un email breve, personalizado y natural (NO de plantilla genérica). Debe:
- Mencionar algo específico del restaurante (nombre, cocina, zona)
- Presentar QuantiChef en 1 frase: "software que calcula el food cost de tus platos automáticamente leyendo tus facturas de proveedor"
- Ofrecer una prueba gratuita de 3 días sin tarjeta
- Terminar con una pregunta directa y simple
- Tono cercano, como de colega del sector, NO corporativo
- Máximo 120 palabras
- Asunto del email incluido

Responde SOLO con JSON válido:
{
  "score": 7,
  "razon_score": "Restaurante activo con muchas reseñas y precio medio-alto",
  "asunto": "Asunto del email aquí",
  "email": "Cuerpo del email aquí"
}`;

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await aiResp.json();
    const raw = aiData.content?.[0]?.text || '';
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1) return res.status(422).json({ error: 'Claude no devolvió JSON válido' });

    const resultado = JSON.parse(raw.substring(first, last + 1));
    return res.json(resultado);
  }

  // ── GUARDAR lead en Supabase ──────────────────────────────────────────
  if (mode === 'guardar_lead') {
    const { lead } = req.body;
    if (!lead) return res.status(400).json({ error: 'Falta el lead' });

    const { data, error } = await supabase
      .from('leads_prospeccion')
      .upsert({ ...lead, updated_at: new Date().toISOString() }, { onConflict: 'yelp_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ lead: data });
  }

  // ── ACTUALIZAR estado de lead ─────────────────────────────────────────
  if (mode === 'actualizar_estado') {
    const { yelp_id, estado, notas } = req.body;
    const { error } = await supabase
      .from('leads_prospeccion')
      .update({ estado, notas, updated_at: new Date().toISOString() })
      .eq('yelp_id', yelp_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Modo no reconocido' });
}
