import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Usamos SERVICE_ROLE_KEY para que el backend tenga permiso de lectura total
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Price IDs permitidos — asegúrate de que coincidan con tu Dashboard de Stripe
const PRICE_IDS_VALIDOS = [
  'price_1TNhYqQ2tw1TGl0PZBWpbvjZ', // mensual 39€
  'price_1TNhY8Q2tw1TGl0PpCFivavL', // anual 349€
];

export default async function handler(req, res) {
  // Configuración de CORS dinámica
  const origin = req.headers.origin;
  if (origin && origin.includes('quantichef.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. VERIFICAR SESIÓN
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

  try {
    const { priceId } = req.body;

    // 2. VALIDAR PRICE ID
    if (!priceId || !PRICE_IDS_VALIDOS.includes(priceId)) {
      return res.status(400).json({ error: 'Plan no válido' });
    }

    // 3. OBTENER RESTAURANTE (Con Service Role no fallará el 403)
    const { data: restaurante, error: restError } = await supabase
      .from('restaurantes')
      .select('id, stripe_customer_id, plan')
      .eq('user_id', user.id)
      .single();

    if (restError || !restaurante) {
      console.error('Error buscando restaurante:', restError);
      return res.status(403).json({ error: 'No se encontró el perfil del restaurante' });
    }

    // 4. EVITAR CHECKOUTS SI YA ES PRO
    if (restaurante.plan === 'pro') {
      return res.status(400).json({ error: 'Ya tienes un plan activo' });
    }

    // 5. CONFIGURAR SESIÓN DE STRIPE
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://www.quantichef.com/dashboard?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.quantichef.com/precios`,
      metadata: { 
        userId: user.id, 
        restauranteId: restaurante.id 
      },
      locale: 'es',
      allow_promotion_codes: true,
    };

    // Si ya tenemos un ID de cliente de Stripe, lo usamos. Si no, Stripe pedirá el email.
    if (restaurante.stripe_customer_id) {
      sessionParams.customer = restaurante.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
    }

    // 6. CREAR SESIÓN CON IDEMPOTENCIA
    const session = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: `checkout-${restaurante.id}-${priceId}-${Math.floor(Date.now() / 60000)}` }
    );

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Error al conectar con el sistema de pago' });
  }
}
