import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Inicializar Supabase (usamos la Service Key para poder leer todos los usuarios)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // Configuración CORS simple (Solo permitir peticiones desde tu propia web o localhost)
  const allowedOrigins = ['https://quantichef.com', 'https://www.quantichef.com', 'http://127.0.0.1:5500', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Pequeña capa de seguridad: Pide un password por Query String
  const { key } = req.query;
  if (key !== 'Amore1206.') {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener Total de Usuarios Registrados
    const { count: totalUsuarios, error: errUsers } = await supabase
      .from('restaurantes')
      .select('*', { count: 'exact', head: true });

    // 2. Obtener Usuarios PRO (Activos)
    const { count: usuariosPro, error: errPro } = await supabase
      .from('restaurantes')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'pro');

    // 3. Obtener el MRR (Monthly Recurring Revenue) de Stripe
    // Obtenemos todas las suscripciones activas
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.plan']
    });

    let mrrCents = 0;
    subscriptions.data.forEach(sub => {
      const amount = sub.plan.amount;
      const interval = sub.plan.interval; // 'month' o 'year'
      
      if (interval === 'month') {
        mrrCents += amount;
      } else if (interval === 'year') {
        mrrCents += Math.floor(amount / 12); // Dividir el anual entre 12
      }
    });

    const mrrEuros = mrrCents / 100;

    // Responder con las métricas
    return res.status(200).json({
      success: true,
      metrics: {
        total_usuarios: totalUsuarios || 0,
        usuarios_pro: usuariosPro || 0,
        mrr_euros: mrrEuros
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ error: 'Error cargando las analíticas' });
  }
}
