import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Iniciamos Stripe y Supabase con tus claves de entorno
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Configuración de cabeceras para CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { restauranteId } = req.body;

    if (!restauranteId) {
      return res.status(400).json({ error: 'Falta el ID del restaurante' });
    }

    // 1. Buscamos el ID de cliente de Stripe asociado a este restaurante
    const { data: rest, error } = await supabase
      .from('restaurantes')
      .select('stripe_customer_id')
      .eq('id', restauranteId)
      .single();

    if (error || !rest || !rest.stripe_customer_id) {
      return res.status(400).json({ 
        error: 'No se ha encontrado un cliente de Stripe válido. ¿Hiciste el pago a través del sistema?' 
      });
    }

    // 2. Le pedimos a Stripe que genere un enlace seguro de 1 solo uso
    const session = await stripe.billingPortal.sessions.create({
      customer: rest.stripe_customer_id,
      return_url: 'https://www.quantichef.com/dashboard', // Donde vuelve el usuario al salir del portal
    });

    // 3. Devolvemos la URL al navegador
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Error en Stripe Portal:', err);
    return res.status(500).json({ error: err.message });
  }
}
