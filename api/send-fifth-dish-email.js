import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, nombre } = req.body; // 'nombre' será el nombre del restaurante

  try {
    const response = await resend.emails.send({
      from: 'QuantiChef <hola@quantichef.com>',
      to: email,
      subject: '¡Acabas de alcanzar el límite! 🎯',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F9F7F2; padding: 40px; border-radius: 20px; border: 1px solid #E0DDD6;">

          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.quantichef.com/apple-touch-icon.png" width="68" height="68" style="border-radius: 16px; vertical-align: middle; box-shadow: 0 4px 10px rgba(196,148,58,0.2);" alt="QuantiChef Logo">
            <h1 style="font-family: 'Fraunces', Georgia, serif; color: #1E4D2B; margin-top: 16px; font-size: 28px; margin-bottom: 2px; font-weight: 600; letter-spacing: -0.5px;">QuantiChef</h1>
            <p style="color: #C4943A; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; font-weight: bold; margin-top: 0;">Cocina Rentable</p>
          </div>

          <div style="background-color: #FFFFFF; padding: 30px; border-radius: 15px; border: 1px solid #E0DDD6;">
            
            <h2 style="color: #1E4D2B; margin-top: 0; margin-bottom: 20px; font-size: 22px;">¡Llegaste al 5to escandallo!</h2>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Hola <strong>${nombre}</strong>,
            </p>
            
            <p style="color: #1A1916; font-size: 16px; line-height: 1.6;">
              Ya has probado tus 5 escandallos gratis. <strong>¿Qué te ha parecido?</strong>
            </p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #E8F2EC; border-left: 4px solid #1E4D2B; border-radius: 4px;">
              <p style="color: #1A1916; margin: 0; font-size: 15px; line-height: 1.5;">
                Otros chefs como tú descubrieron que algunos de sus platos más populares en realidad les hacían perder dinero. QuantiChef lo encontró en minutos.
              </p>
            </div>
            
            <h3 style="color: #3D7A54; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">¿Cuál es tu siguiente movimiento?</h3>
            
            <p style="color: #1A1916; font-size: 15px; line-height: 1.8;">
              <strong>Opción A:</strong> Pasa a Pro. 39€/mes. <strong>La primera semana es gratis</strong> para que lo pruebes a fondo. Tendrás acceso ilimitado a escandallos, alertas de precio y lectura de albaranes por IA.
            </p>
            
            <p style="color: #1A1916; font-size: 15px; line-height: 1.8;">
              <strong>Opción B:</strong> Cuéntame qué te falta. Quizás tienes una idea genial que otros chefs también necesitan.
            </p>
            
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://quantichef.com/precios" style="display: inline-block; padding: 14px 28px; background-color: #1E4D2B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                Pasar a Pro (39€/mes) →
              </a>
            </div>

          </div>
          
          <p style="color: #8A8784; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
            O simplemente responde a este email. Soy Massimo, y leo cada mensaje.
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
