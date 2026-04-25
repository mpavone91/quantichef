import { createClient } from '@supabase/supabase-js';

// Configuración Supabase (SERVICE ROLE KEY obligatoria para Serverless)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuración de la API de Anthropic (Claude)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
    // 1. Validaciones iniciales
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    }

    const { file_base64, file_type, restaurante_id } = req.body;
    const authHeader = req.headers.authorization;

    if (!file_base64 || !file_type || !restaurante_id) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (archivo, tipo o ID de restaurante).' });
    }

    if (!authHeader) {
        return res.status(401).json({ error: 'Falta token de autenticación.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
        return res.status(401).json({ error: 'Sesión inválida.' });
    }

    try {
        // 2. Extraer y Normalizar la Ficha Técnica usando Claude
        const claudeData = await parseRecipeWithClaude(file_base64, file_type);
        
        if (!claudeData || !claudeData.platos || claudeData.platos.length === 0) {
             return res.status(400).json({ error: 'No se detectaron platos estructurados en el documento.' });
        }

        // 3. Obtener el inventario de precios del restaurante
        const { data: preciosProveedor, error: errorPrecios } = await supabase
            .from('precios_proveedor')
            .select('*')
            .eq('restaurante_id', restaurante_id);

        if (errorPrecios) {
            console.error("Error al cargar precios:", errorPrecios);
            // Si falla, seguimos con un array vacío para usar precios estimados (0€)
        }

        const inventarioPrecios = preciosProveedor || [];

        // 4. Cruzar Datos y Guardar en Supabase
        let platosGuardados = 0;

        for (const plato of claudeData.platos) {
            const ingredientesConPrecio = plato.ingredientes.map(ing => {
                const ingredienteGuardado = buscarMejorCoincidencia(ing.nombre, inventarioPrecios);
                let precioBase = 0;

                if (ingredienteGuardado) {
                    precioBase = ingredienteGuardado.precio_kg;
                    // Lógica sencilla de unidades. Claude ya nos devuelve g o ml.
                    // Si el ingredienteGuardado es precio_kg, el precio por gramo es precio_kg / 1000.
                }

                // Cálculo coste ingrediente (Asumiendo que cantidad extraída está en gramos/ml y precioBase es por Kg/L)
                const costeLinea = ingredienteGuardado ? (ing.cantidad_gr / 1000) * precioBase : 0;

                return {
                    nombre: ing.nombre,
                    cantidad: ing.cantidad_gr,
                    unidad: ing.unidad_original,
                    precio_kg: precioBase,
                    coste: Number(costeLinea.toFixed(2))
                };
            });

            const costeRacion = ingredientesConPrecio.reduce((acc, curr) => acc + curr.coste, 0);
            
            // Asignar precio de carta si Claude lo encontró, o un estimado del 30% FC
            const precio_carta = plato.precio_venta || 0;
            const precio_venta_estimado = precio_carta > 0 ? precio_carta : costeRacion / 0.3;
            const food_cost_pct = precio_carta > 0 ? (costeRacion / precio_carta) * 100 : 30;

            const { error: insertError } = await supabase.from('escandallos').insert({
                user_id: userData.user.id,
                restaurante_id: restaurante_id,
                nombre_plato: plato.nombre,
                categoria: plato.categoria || 'Importado',
                precio_venta: Number(precio_venta_estimado.toFixed(2)),
                precio_carta: Number(precio_carta.toFixed(2)),
                coste_racion: Number(costeRacion.toFixed(2)),
                food_cost_pct: Number(food_cost_pct.toFixed(2)),
                ingredientes: ingredientesConPrecio,
                elaboracion: plato.elaboracion || '',
                origen: 'ficha_tecnica'
            });

            if (insertError) {
                console.error("Error guardando plato:", plato.nombre, insertError);
            } else {
                platosGuardados++;
            }
        }

        return res.status(200).json({ success: true, cantidad: platosGuardados });

    } catch (error) {
        console.error("Error en extract-recipe:", error);
        return res.status(500).json({ error: 'Error procesando la ficha técnica: ' + error.message });
    }
}

// ---- FUNCIONES AUXILIARES ----

async function parseRecipeWithClaude(base64Image, fileType) {
    const prompt = `
Eres un Jefe de Cocina analizando una ficha técnica. 
Quiero que leas el documento adjunto y extraigas TODOS los platos y sus recetas.

**REGLAS ESTRICTAS DE EXTRACCIÓN:**
1. NO inventes recetas. Solo extrae lo que está escrito.
2. Convierte las cantidades a GRAMOS (gr) o MILILITROS (ml) en la clave "cantidad_gr". Ejemplo: "1 kg" -> 1000, "1 cucharada" -> 15, "1 unidad mediana" -> 150 (estimado).
3. Si la ficha incluye el precio de venta al público (PVP), añádelo en "precio_venta". Si no lo indica, pon 0.
4. Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura, sin texto markdown antes ni después:

{
  "platos": [
    {
      "nombre": "Nombre del Plato",
      "categoria": "Categoría (ej. Principal, Postre, Entrante)",
      "precio_venta": 15.50,
      "elaboracion": "Pasos de la receta si los hay (opcional)",
      "ingredientes": [
        {
          "nombre": "Nombre del ingrediente",
          "cantidad_gr": 200,
          "unidad_original": "200 gr"
        }
      ]
    }
  ]
}
`;

    // Lógica para separar PDFs de Imágenes (El fix del error)
    const isPdf = fileType.toLowerCase() === "pdf";
    const blockType = isPdf ? "document" : "image";
    let mediaType = "image/jpeg"; // Por defecto

    if (isPdf) {
        mediaType = "application/pdf";
    } else if (fileType.toLowerCase() === "png") {
        mediaType = "image/png";
    } else if (fileType.toLowerCase() === "webp") {
        mediaType = "image/webp";
    }

    const requestBody = {
        model: "claude-haiku-4-5-20251001", // Modelo actualizado
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: blockType,
                        source: {
                            type: "base64",
                            media_type: mediaType,
                            data: base64Image
                        }
                    },
                    {
                        type: "text",
                        text: prompt
                    }
                ]
            }
        ]
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error("Error en la API de Anthropic: " + errText);
    }

    const data = await response.json();
    let jsonString = data.content[0].text;
    
    // Limpieza de Markdown si Claude lo envía a pesar de las instrucciones
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Claude no devolvió un JSON válido.");
    }
}

// Búsqueda difusa simple para cruzar nombres (Ej: "Tomate pera" -> "Tomate")
function buscarMejorCoincidencia(nombreIngrediente, inventarioPrecios) {
    if (!inventarioPrecios || inventarioPrecios.length === 0) return null;
    
    const query = nombreIngrediente.toLowerCase().trim();
    
    // 1. Búsqueda exacta
    let match = inventarioPrecios.find(p => p.ingrediente_normalizado.toLowerCase() === query);
    if (match) return match;

    // 2. Búsqueda por inclusión (si "Tomate Pera" incluye "Tomate")
    match = inventarioPrecios.find(p => query.includes(p.ingrediente_normalizado.toLowerCase()) || p.ingrediente_normalizado.toLowerCase().includes(query));
    
    return match || null;
}
