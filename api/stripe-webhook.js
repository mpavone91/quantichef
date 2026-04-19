import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Service role para escribir sin RLS
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

  // ── IDEMPOTENCIA: no procesar el mismo evento dos veces ─────────
  const { data: existente } = await supabase
    .from('stripe_events_procesados')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existente) {
    console.log(`Evento ${event.id} ya procesado — skip`);
    return res.status(200).json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {

      // ✅ Pago exitoso — activar plan pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restauranteId = session.metadata?.restauranteId;
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;

        // ❌ SIN FALLBACK — si no hay restauranteId en metadata, 
        // es un checkout corrupto o manipulado. No actuamos.
        if (!restauranteId) {
          console.error(`Checkout sin restauranteId en metadata: ${session.id}`);
          await registrarError(event, 'Sin restauranteId en metadata');
          break;
        }

        // Validar que el restaurante existe antes de activar
        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('id', restauranteId)
          .maybeSingle();

        if (!rest) {
          console.error(`Restaurante ${restauranteId} no encontrado`);
          await registrarError(event, `Restaurante ${restauranteId} no existe`);
          break;
        }

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
          await registrarError(event, error.message);
        } else {
          console.log(`Plan pro activado para restaurante ${restauranteId}`);
        }
        break;
      }

      // ❌ Suscripción cancelada — volver a trial
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (rest) {
          await supabase
            .from('restaurantes')
            .update({ 
              plan: 'trial',
              stripe_subscription_id: null
            })
            .eq('id', rest.id);
          console.log(`Plan cancelado para restaurante ${rest.id}`);
        }
        break;
      }

      // ⚠️ Estado de suscripción cambió (past_due, unpaid, etc.)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!rest) break;

        // Si la suscripción está en mora tras múltiples intentos → suspender
        if (status === 'unpaid' || status === 'incomplete_expired') {
          await supabase
            .from('restaurantes')
            .update({ plan: 'trial' })
            .eq('id', rest.id);
          console.log(`Plan suspendido (${status}) para restaurante ${rest.id}`);
        }
        // Si vuelve a estar activa tras un fallo → reactivar
        else if (status === 'active') {
          await supabase
            .from('restaurantes')
            .update({ plan: 'pro' })
            .eq('id', rest.id);
          console.log(`Plan reactivado para restaurante ${rest.id}`);
        }
        break;
      }

      // ⚠️ Pago fallido en renovación — solo logueamos
      // La acción real viene en customer.subscription.updated
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`Pago fallido para customer ${invoice.customer}`);
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // ── REGISTRAR EVENTO COMO PROCESADO ─────────────────────────
    await supabase
      .from('stripe_events_procesados')
      .insert({ event_id: event.id, event_type: event.type });

  } catch (err) {
    console.error('Error procesando webhook:', err);
    await registrarError(event, err.message);
    // Devolver 200 igualmente para que Stripe no reintente infinitamente
    // El error queda registrado en logs
  }

  return res.status(200).json({ received: true });
}

// Helper para registrar errores — puedes crear tabla errores_webhook si quieres persistirlos
async function registrarError(event, mensaje) {
  console.error(`[WEBHOOK ERROR] ${event.type} | ${event.id} | ${mensaje}`);
  // Si quieres guardar en BD, descomenta y crea la tabla:
  // await supabase.from('errores_webhook').insert({
  //   event_id: event.id,
  //   event_type: event.type,
  //   mensaje,
  //   payload: event.data.object
  // });
}
