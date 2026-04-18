import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

    // Get restaurante
    const { data: rest, error: restError } = await sb
      .from('restaurantes')
      .select('id, plan, escandallos_count')
      .eq('user_id', user.id)
      .single();

    if (restError || !rest) return res.status(404).json({ error: 'Restaurante no encontrado' });

    const esPro = rest.plan === 'pro';
    const count = rest.escandallos_count || 0;
    const MAX_FREE = 5;

    return res.status(200).json({
      esPro,
      count,
      puedeCrear: esPro || count < MAX_FREE,
      restantes: esPro ? null : Math.max(0, MAX_FREE - count)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
