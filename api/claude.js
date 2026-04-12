export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Usamos el modelo más estable y barato
        max_tokens: 1024,
        messages: req.body.messages // Solo cogemos los mensajes del HTML
      })
    });

    const data = await response.json();
    
    // Si Anthropic nos da un error, se lo pasamos a la web para saber qué pasa
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error de la IA' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error de conexión: ' + err.message });
  }
}
