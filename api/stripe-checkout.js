import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Price IDs permitidos — nunca confiar en el cliente
const PRICE_IDS_VALIDOS = [
  'price_1TNhYqQ2tw1TGl0PZBWpbvjZ', // mensual 39€
  'price_1TNhY8Q2tw1TGl0PpCFivavL', // anual 349€
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. VERIFICAR SESIÓN ──────────────────────────────────────
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

  try {
    const { priceId } = req.body;

    // ── 2. VALIDAR PRICE ID CONTRA LISTA BLANCA ─────────────────
    if (!priceId || !PRICE_IDS_VALIDOS.includes(priceId)) {
      return res.status(400).json({ error: 'Plan no válido' });
    }

    // ── 3. OBTENER RESTAURANTE DEL USUARIO AUTENTICADO ──────────
    // NUNCA confiar en userId/restauranteId del body
    const { data: restaurante, error: restError } = await supabase
      .from('restaurantes')
      .select('id, stripe_customer_id, plan')
      .eq('user_id', user.id)
      .single();

    if (restError || !restaurante) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    // ── 4. EVITAR CHECKOUTS DUPLICADOS SI YA ES PRO ─────────────
    if (restaurante.plan === 'pro') {
      return res.status(400).json({ error: 'Ya tienes un plan activo' });
    }

    // ── 5. CONFIGURAR SESIÓN — REUTILIZAR CUSTOMER SI EXISTE ────
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://www.quantichef.com/dashboard?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.quantichef.com/precios`,
      // metadata viene del backend, NO del cliente
      metadata: { 
        userId: user.id, 
        restauranteId: restaurante.id 
      },
      locale: 'es',
      allow_promotion_codes: true,
    };

    // Reutilizar customer de Stripe si ya existe (evita duplicados)
    if (restaurante.stripe_customer_id) {
      sessionParams.customer = restaurante.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
    }

    // ── 6. IDEMPOTENCY KEY — EVITA DOBLE CLIC ───────────────────
    const session = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: `checkout-${restaurante.id}-${priceId}-${Date.now().toString().slice(0, -4)}` }
      // slice(0,-4) = idempotencia por minuto, suficiente para doble clic pero permite reintentar después
    );

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    // No exponer mensaje interno al cliente
    return res.status(500).json({ error: 'Error al crear la sesión de pago' });
  }
}