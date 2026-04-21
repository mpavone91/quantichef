import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Crucial para saltar RLS y poder leer usuarios
);

export default async function handler(req, res) {
  // Aseguramos que solo responda a POST (o a llamadas CRON de Vercel)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificamos el token de seguridad si es un CRON (opcional pero recomendado)
  const authHeader = req.headers.authorization;
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    req.headers['x-vercel-cron'] !== '1' // Si viene directo del cron de Vercel
  ) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // 1. Obtener usuarios en trial que se registraron hace ~2 días
    const today = new Date();
    
    // Calculamos el inicio del día hace 2 días
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);

    // Calculamos el final de ese mismo día
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const { data: restaurantes, error } = await supabase
      .from('restaurantes')
      .select('id, nombre, plan, created_at, user_id') // Necesitamos user_id para buscar su email
      .eq('plan', 'trial')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (error) throw error;
    if (!restaurantes || restaurantes.length === 0) {
      return res.status(200).json({ sent: 0, message: "No hay usuarios en su Día 2 hoy." });
    }

    // 2. Obtener lista de emails (Solo Service Role puede hacer esto)
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    let correosEnviados = 0;

    // 3. Procesar envíos
    for (const rest of restaurantes) {
      const authUser = authUsers.find(u => u.id === rest.user_id);
      if (!authUser || !authUser.email) continue;

      const email = authUser.email;
      
      // Contar escandallos
      const { count } = await supabase
        .from('escandallos')
        .select('*', { count: 'exact', head: true })
        .eq('restaurante_id', rest.id);
        
      const trialsLeft = Math.max(0, 5 - (count || 0));

      await resend.emails.send({
        from: 'QuantiChef <hola@quantichef.com>',
        to: email,
        subject: 'Tu prueba gratuita termina mañana 😅',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

           <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

            <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
              <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">Tu prueba termina mañana ⏳</h2>
              
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
                Hola <strong>${rest.nombre}</strong>,
              </p>
              
              <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
                Ya has empezado a probar QuantiChef. ¿Has descubierto algo interesante en tu cocina?
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
                <p style="color: #1A1916; margin: 0; font-size: 15px;">
                  <strong>📊 Te quedan ${trialsLeft} escandallos</strong> para probar hoy.
                </p>
              </div>
              
              <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Lo que otros chefs encontraron:</h3>
              
              <ul style="color: #1A1916; font-size: 15px; line-height: 1.8; padding-left: 20px;">
                <li>✅ Platos que creían rentables pero les hacían perder dinero.</li>
                <li>✅ La forma exacta de subir precios sin asustar a los clientes.</li>
                <li>✅ El impacto real cuando su proveedor sube la materia prima.</li>
              </ul>
              
              <p style="color: #1A1916; font-size: 16px; margin-top: 30px; line-height: 1.6;">
                ¿Quieres tener el control total de tus márgenes?<br>
                Cuesta solo <strong>39€ al mes</strong> (lo recuperas con el primer plato que corrijas).
              </p>
              
              <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
                <a href="https://www.quantichef.com/precios" style="display: inline-block; padding: 14px 28px; background-color: #C4943A; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                  Ver planes y suscribirse →
                </a>
              </div>
            </div>
            
            <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
              ¿Tienes dudas? Responde a este email.<br>Soy Massimo, fundador de QuantiChef.
            </p>
            
          </div>
        `
      });
      
      correosEnviados++;
    }

    return res.status(200).json({ success: true, sent: correosEnviados });
  } catch (error) {
    console.error('Error en el envío automático:', error);
    return res.status(500).json({ error: error.message });
  }
}
