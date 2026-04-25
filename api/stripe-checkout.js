import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICE_IDS_VALIDOS = [
  'price_1TNhYqQ2tw1TGl0PZBWpbvjZ', // mensual 39€
  'price_1TNhY8Q2tw1TGl0PpCFivavL', // anual 349€
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && origin.includes('quantichef.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

  try {
    const { priceId } = req.body;

    if (!priceId || !PRICE_IDS_VALIDOS.includes(priceId)) {
      return res.status(400).json({ error: 'Plan no válido' });
    }

    const { data: restaurante, error: restError } = await supabase
      .from('restaurantes')
      .select('id, stripe_customer_id, plan, nombre')
      .eq('user_id', user.id)
      .single();

    if (restError || !restaurante) {
      return res.status(403).json({ error: 'No se encontró el perfil del restaurante' });
    }

    if (restaurante.plan === 'pro') {
      return res.status(400).json({ error: 'Ya tienes un plan activo' });
    }

    // CONFIGURACIÓN DE SESIÓN PREMIUM
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        // 🎁 7 DÍAS GRATIS: No se cobra nada hasta pasado este tiempo
        trial_period_days: 7, 
        metadata: { restauranteId: restaurante.id }
      },
      // 📝 RECOGIDA DE DATOS LEGALES (CIF/NIF y Dirección)
      tax_id_collection: { enabled: true }, 
      billing_address_collection: 'required',
      
      success_url: `https://www.quantichef.com/dashboard?pago=ok`,
      cancel_url: `https://www.quantichef.com/precios`,
      
      metadata: { 
        userId: user.id, 
        restauranteId: restaurante.id,
        nombreRestaurante: restaurante.nombre
      },
      locale: 'es',
      allow_promotion_codes: true,
    };

    if (restaurante.stripe_customer_id) {
      sessionParams.customer = restaurante.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: `checkout-${restaurante.id}-${priceId}` }
    );

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Error al conectar con el sistema de pago' });
  }
}
