import { createClient } from '@supabase/supabase-js';

// Usamos SERVICE_ROLE_KEY para poder hacer updateUserById sin confirmación de email
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    // Verificar que el userId viene de una sesión real (el Authorization header)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar el token del usuario con el cliente normal
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user || user.id !== userId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Comprobar que el email no está ya en uso por otro usuario
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const emailTaken = existing?.users?.some(u => u.email === email && u.id !== userId);
    if (emailTaken) {
      return res.status(400).json({ error: 'Este email ya está registrado con otra cuenta.' });
    }

    // Vincular email + password sin necesidad de confirmación (admin bypass)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true, // Marca el email como confirmado directamente
      user_metadata: { nombre, apellidos, telefono }
    });

    if (updateError) {
      console.error('updateUserById error:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('link-account error:', err);
    return res.status(500).json({ error: err.message });
  }
}
