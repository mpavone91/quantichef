// Ejemplo de lógica para tu archivo /api/stripe-portal.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { userId, restauranteId } = req.body;

  // 1. Buscamos el ID de cliente de Stripe en tu base de datos para ese restaurante
  const { data: rest } = await supabase
    .from('restaurantes')
    .select('stripe_customer_id')
    .eq('id', restauranteId)
    .single();

  // 2. Creamos la sesión del portal
  const session = await stripe.billingPortal.sessions.create({
    customer: rest.stripe_customer_id,
    return_url: 'https://www.quantichef.com/dashboard',
  });

  // 3. Devolvemos la URL
  return res.status(200).json({ url: session.url });
}
