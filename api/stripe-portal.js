import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Cliente con service_role para consultar la base de datos saltando RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cliente ANON para verificar la identidad del usuario que hace la petición
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

  try {
    // ── 1. VERIFICACIÓN DE SESIÓN ─────────────────────────────────
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Falta token' });
    }

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Sesión inválida o caducada' });
    }

    // ── 2. OBTENER RESTAURANTE DEL TOKEN — sin depender del body ──
    // No aceptamos restauranteId del cliente — lo resolvemos desde el token
    const { data: rest, error: dbError } = await supabaseAdmin
      .from('restaurantes')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (dbError || !rest || !rest.stripe_customer_id) {
      return res.status(403).json({
        error: 'No tienes un plan activo o no eres cliente de Stripe.'
      });
    }

    // ── 3. GENERAR ENLACE SEGURO DE STRIPE ───────────────────────
    const session = await stripe.billingPortal.sessions.create({
      customer: rest.stripe_customer_id,
      return_url: 'https://www.quantichef.com/dashboard',
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Error en stripe-portal:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
