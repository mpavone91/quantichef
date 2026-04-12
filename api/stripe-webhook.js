import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const restauranteId = session.metadata?.restauranteId;
        if (!userId || !restauranteId) break;

        await sb.from('restaurantes').update({
          plan: 'pro',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_activo_hasta: null
        }).eq('id', restauranteId);

        console.log(`Plan activado para restaurante ${restauranteId}`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub = event.data.object;
        await sb.from('restaurantes').update({
          plan: 'trial',
          stripe_subscription_id: null,
          plan_activo_hasta: null
        }).eq('stripe_subscription_id', sub.id);

        console.log(`Plan cancelado para suscripcion ${sub.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const activo = sub.status === 'active' || sub.status === 'trialing';
        await sb.from('restaurantes').update({
          plan: activo ? 'pro' : 'trial',
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await sb.from('restaurantes').update({
          plan: 'trial'
        }).eq('stripe_customer_id', invoice.customer);
        console.log(`Pago fallido para customer ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ received: true });
}
