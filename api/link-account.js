import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, email, password, nombre, apellidos, telefono } = req.body;

    if (!userId || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Validación básica email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }

    // Verificar token — el userId del body debe coincidir con el del token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user || user.id !== userId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Vincular email + password
    // Si el email ya existe, Supabase devuelve error — no necesitamos listUsers()
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellidos, telefono }
    });

    if (updateError) {
      // Detectar email duplicado del mensaje de error de Supabase
      const isDuplicate = updateError.message?.toLowerCase().includes('already registered')
        || updateError.message?.toLowerCase().includes('already exists')
        || updateError.message?.toLowerCase().includes('duplicate');

      if (isDuplicate) {
        return res.status(400).json({ error: 'Este email ya está registrado con otra cuenta.' });
      }

      console.error('updateUserById error:', updateError);
      // No exponer mensaje interno
      return res.status(400).json({ error: 'Error al vincular la cuenta. Inténtalo de nuevo.' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('link-account error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
