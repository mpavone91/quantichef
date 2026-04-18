import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Usar service_role key para poder escribir sin RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false, // Stripe necesita el body raw para verificar la firma
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Firma inválida' });
  }

  // Procesar los eventos relevantes
  try {
    switch (event.type) {

      // ✅ Pago exitoso — activar plan pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restauranteId = session.metadata?.restauranteId;
        const userId = session.metadata?.userId;
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;

        if (restauranteId) {
          const { error } = await supabase
            .from('restaurantes')
            .update({
              plan: 'pro',
              stripe_customer_id: stripeCustomerId || null,
              stripe_subscription_id: subscriptionId || null,
              plan_activated_at: new Date().toISOString()
            })
            .eq('id', restauranteId);

          if (error) {
            console.error('Error activando plan:', error);
          } else {
            console.log(`Plan pro activado para restaurante ${restauranteId}`);
          }
        } else if (userId) {
          // Fallback: buscar restaurante por userId
          const { error } = await supabase
            .from('restaurantes')
            .update({
              plan: 'pro',
              stripe_customer_id: stripeCustomerId || null,
              stripe_subscription_id: subscriptionId || null,
              plan_activated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (error) {
            console.error('Error activando plan por userId:', error);
          } else {
            console.log(`Plan pro activado para usuario ${userId}`);
          }
        }
        break;
      }

      // ❌ Suscripción cancelada — volver a trial
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Buscar restaurante por stripe_customer_id
        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (rest) {
          await supabase
            .from('restaurantes')
            .update({ plan: 'trial' })
            .eq('id', rest.id);
          console.log(`Plan cancelado para restaurante ${rest.id}`);
        }
        break;
      }

      // ⚠️ Pago fallido en renovación
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        console.log(`Pago fallido para customer ${customerId}`);
        // Por ahora solo logueamos — podrías enviar un email de aviso
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }
  } catch (err) {
    console.error('Error procesando webhook:', err);
    return res.status(500).json({ error: 'Error interno' });
  }

  // Siempre responder 200 a Stripe para que no reintente
  return res.status(200).json({ received: true });
}
