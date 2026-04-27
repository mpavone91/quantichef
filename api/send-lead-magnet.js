const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, nombre } = req.body;

  if (!email || !nombre) {
    return res.status(400).json({ error: 'Missing email or name' });
  }

  try {
    const data = await resend.emails.send({
      from: 'Massimo de QuantiChef <hola@quantichef.com>',
      to: [email],
      subject: `Tu Plantilla Excel de Escandallos está aquí 📊`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1916;">
          <h2 style="color: #1E4D2B;">¡Hola ${nombre}!</h2>
          <p>Gracias por solicitar la plantilla gratuita para tus escandallos. Sabemos lo tedioso que es picar datos a mano, así que esperamos que este Excel te facilite un poco la vida.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://quantichef.com/plantilla_escandallos.csv" style="background-color: #C4943A; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Descargar Plantilla Excel
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #E0DDD6; margin: 30px 0;">

          <h3 style="color: #1E4D2B;">¿Un pequeño secreto entre nosotros?</h3>
          <p>Usar Excel para escandallos en 2026 es como usar una máquina de escribir. Tienes que actualizar los precios a mano cada semana, buscar los albaranes y calcular mermas con la calculadora.</p>
          <p>En QuantiChef, simplemente subes una foto del albarán y el sistema actualiza todos los precios de tus platos <strong>automáticamente</strong>.</p>
          
          <p><a href="https://quantichef.com/auth.html" style="color: #1E4D2B; font-weight: bold;">Pruébalo gratis durante 3 días</a> y olvídate del Excel para siempre.</p>

          <br>
          <p>Un saludo,<br>
          <strong>Massimo Pavone</strong><br>
          CEO de QuantiChef</p>
        </div>
      `
    });

    res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error('Error al enviar Lead Magnet:', error);
    res.status(500).json({ error: error.message });
  }
};
