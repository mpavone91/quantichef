export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file_base64, file_type, file_name } = req.body;

    if (!file_base64 || !file_type) {
      return res.status(400).json({ error: 'Falta el archivo o el tipo' });
    }

    // Determinar el media_type para la API de Anthropic
    let media_type;
    let content_block;

    if (file_type === 'pdf') {
      media_type = 'application/pdf';
      content_block = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: media_type,
          data: file_base64
        }
      };
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(file_type)) {
      media_type = `image/${file_type === 'jpg' ? 'jpeg' : file_type}`;
      content_block = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: media_type,
          data: file_base64
        }
      };
    } else if (['csv', 'xlsx', 'xls', 'txt'].includes(file_type)) {
      // Para archivos de texto/CSV, decodificar el base64 y enviar como texto
      const text_content = Buffer.from(file_base64, 'base64').toString('utf-8');
      content_block = {
        type: 'text',
        text: `Contenido del archivo ${file_name}:\n\n${text_content}`
      };
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usa PDF, imagen, CSV o Excel.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              content_block,
              {
                type: 'text',
                text: `Eres un asistente experto en hostelería española. Analiza este documento de proveedor (albarán, factura, lista de precios o catálogo) y extrae TODOS los productos alimentarios con sus precios.

Para cada producto, devuelve:
- nombre: el nombre del producto tal como aparece
- ingrediente_normalizado: el nombre simplificado y genérico del ingrediente, en minúsculas, sin tildes, sin marcas comerciales (ej: "PECHUGA POLLO FRESCA CAT.A" → "pechuga de pollo")
- precio: el precio numérico (solo el número, sin símbolo €)
- unidad: la unidad de medida (kg, l, ud, caja, docena, etc.)
- proveedor: el nombre del proveedor si aparece en el documento

IMPORTANTE:
- Si el precio es por caja/bolsa, intenta calcular el precio por kg o por unidad si hay información suficiente
- Si no puedes determinar la unidad, pon "ud"
- Ignora productos no alimentarios (limpieza, envases, etc.)
- Si hay varios precios para el mismo producto (con/sin IVA), usa el precio SIN IVA

Responde SOLO con un JSON válido, sin markdown, sin backticks, con esta estructura exacta:
{
  "proveedor": "Nombre del proveedor",
  "fecha_documento": "YYYY-MM-DD o null si no aparece",
  "productos": [
    {
      "nombre": "nombre original",
      "ingrediente_normalizado": "nombre simplificado",
      "precio": 0.00,
      "unidad": "kg"
    }
  ]
}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error de la API' });
    }

    // Extraer el JSON de la respuesta de Claude
    const raw_text = data.content?.[0]?.text || '';
    
    // Intentar parsear el JSON (limpiar posibles backticks)
    const clean_text = raw_text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean_text);
    } catch (parseErr) {
      return res.status(200).json({ 
        error: 'No se pudo interpretar el documento. Asegúrate de que es un albarán o lista de precios legible.',
        raw: raw_text 
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
