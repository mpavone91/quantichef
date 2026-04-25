import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, nombre, planNombre } = req.body; 

  const firstName = nombre ? nombre.trim().split(' ')[0] : 'Chef';

  try {
    const response = await resend.emails.send({
      from: 'QuantiChef <hola@quantichef.com>',
      to: email,
      subject: '¡Ya eres PRO! Bienvenido a la cocina inteligente 🚀',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Gracias por tu confianza, ${firstName}! 👨‍🍳</h2>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Es oficial: tu suscripción al <strong>${planNombre}</strong> ya está activa. Has tomado la mejor decisión para proteger los márgenes de tu negocio.
            </p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-radius: 10px;">
              <p style="color: #1E4D2B; margin: 0; font-size: 15px; font-weight: 600; text-align: center;">
                🔓 Tienes acceso ILIMITADO a todas las funciones.
              </p>
            </div>

            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">¿Qué puedes hacer ahora?</h3>
            <ul style="color: #1A1916; font-size: 15px; line-height: 1.8; padding-left: 20px; list-style-type: none;">
              <li style="margin-bottom: 10px;">✅ <strong>Escandalla toda tu carta:</strong> Sin límites. Audita cada plato, salsa y guarnición.</li>
              <li style="margin-bottom: 10px;">📸 <strong>Sube todas tus facturas:</strong> Deja que nosotros trabajemos por ti y mantengamos tus precios actualizados al céntimo.</li>
              <li style="margin-bottom: 10px;">📥 <strong>Exporta tus fichas:</strong> Descarga PDFs profesionales para que tu equipo cocine con precisión.</li>
            </ul>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/dashboard" style="display: inline-block; padding: 16px 32px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30,77,43,0.2);">
                Ir a mi panel PRO →
              </a>
            </div>

            <p style="color: #8A8784; font-size: 13px; margin-top: 30px; text-align: center;">
              *Puedes gestionar tu suscripción y descargar tus facturas en cualquier momento desde los ajustes de tu cuenta.
            </p>
          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            Estoy aquí para que saques el máximo provecho a QuantiChef. Si necesitas una sesión rápida por videollamada para configurar algo, solo dímelo.<br><strong>Massimo.</strong>
          </p>
          
        </div>
      `
    });

    return res.status(200).json({ success: true, id: response.data.id });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}