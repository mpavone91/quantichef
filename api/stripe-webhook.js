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

      // ✅ PAGO EXITOSO — ACTIVAR PLAN PRO Y ENVIAR EMAIL
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restauranteId = session.metadata?.restauranteId;
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;
        const customerEmail = session.customer_details?.email; // Email del pagador

        if (!restauranteId) {
          console.error(`Checkout sin restauranteId en metadata: ${session.id}`);
          await registrarError(event, 'Sin restauranteId en metadata');
          break;
        }

        let planLevel = 'basic';
        let planNombreParaEmail = 'Plan Básico';
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = sub.items.data[0].price.id;
            if (priceId === 'price_1TSCKUQ2tw1TGl0PChEw4CWj' || priceId === 'price_1TSCL1Q2tw1TGl0Ppb7tlYda') {
              planLevel = 'pro';
              planNombreParaEmail = 'Plan Pro';
            }
          } catch (e) {
            console.error('No se pudo recuperar la suscripción de Stripe', e);
          }
        }

        // Actualizamos y recuperamos el nombre para el email en un solo paso
        const { data: restUpdated, error } = await supabase
          .from('restaurantes')
          .update({
            plan: planLevel,
            stripe_customer_id: stripeCustomerId || null,
            stripe_subscription_id: subscriptionId || null,
            plan_activated_at: new Date().toISOString()
          })
          .eq('id', restauranteId)
          .select('nombre')
          .single();

        if (error) {
          console.error('Error activando plan:', error);
          await registrarError(event, error.message);
        } else {
          console.log(`Plan pro activado para restaurante ${restauranteId} (${restUpdated.nombre})`);

          // 🔥 DISPARO AUTOMÁTICO DE EMAIL DE BIENVENIDA PRO
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quantichef.com';
            await fetch(`${siteUrl}/api/send-payment-success`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: customerEmail,
                nombre: restUpdated.nombre,
                planNombre: planNombreParaEmail
              })
            });
          } catch (mailErr) {
            console.error('Error enviando email de bienvenida PRO:', mailErr);
          }
        }
        break;
      }

      // ❌ SUSCRIPCIÓN CANCELADA — VOLVER A TRIAL
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

      // ⚠️ ESTADO DE SUSCRIPCIÓN CAMBIÓ
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        let planLevel = 'basic';
        try {
          const priceId = subscription.items.data[0].price.id;
          if (priceId === 'price_1TSCKUQ2tw1TGl0PChEw4CWj' || priceId === 'price_1TSCL1Q2tw1TGl0Ppb7tlYda') {
            planLevel = 'pro';
          }
        } catch(e) {}

        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!rest) break;

        if (status === 'unpaid' || status === 'incomplete_expired') {
          await supabase.from('restaurantes').update({ plan: 'trial' }).eq('id', rest.id);
          console.log(`Plan suspendido (${status}) para restaurante ${rest.id}`);
        }
        else if (status === 'active') {
          await supabase.from('restaurantes').update({ plan: planLevel }).eq('id', rest.id);
          console.log(`Plan reactivado (${planLevel}) para restaurante ${rest.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`Pago fallido para customer ${invoice.customer}`);
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // REGISTRAR EVENTO COMO PROCESADO
    await supabase
      .from('stripe_events_procesados')
      .insert({ event_id: event.id, event_type: event.type });

  } catch (err) {
    console.error('Error procesando webhook:', err);
    await registrarError(event, err.message);
  }

  return res.status(200).json({ received: true });
}

// Helper para errores
async function registrarError(event, mensaje) {
  console.error(`[WEBHOOK ERROR] ${event.type} | ${event.id} | ${mensaje}`);
}
