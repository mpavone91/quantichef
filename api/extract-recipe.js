import { createClient } from '@supabase/supabase-js';

// Cliente con SERVICE ROLE para escribir datos con permisos totales
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Cliente ANON para verificar la sesión del usuario (igual que en extract.js)
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── VERIFICACIÓN DE SESIÓN SEGURA ──
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida o caducada' });

    try {
        const { file_base64, file_type, restaurante_id } = req.body;

        if (!file_base64 || !file_type || !restaurante_id) {
            return res.status(400).json({ error: 'Faltan datos obligatorios para procesar.' });
        }

        // 1. Extraer recetas usando el motor de Claude
        const recipes = await parseRecipeWithClaude(file_base64, file_type);
        
        if (!recipes || !recipes.platos || recipes.platos.length === 0) {
            return res.status(400).json({ error: 'No se detectaron platos en el documento.' });
        }

        // 2. Obtener el inventario de precios del proveedor para cruzar datos
        const { data: inventario } = await supabase
            .from('precios_proveedor')
            .select('*')
            .eq('restaurante_id', restaurante_id);

        const inventarioSeguro = inventario || [];
        let platosGuardados = 0;

        // 3. Procesar cada plato extraído
        for (const plato of recipes.platos) {
            const ingredientesProcesados = (plato.ingredientes || []).map(ing => {
                const match = buscarMejorCoincidencia(ing.nombre, inventarioSeguro);
                const precioBase = match ? parseFloat(match.precio_kg) : 0;
                const cantGramos = parseFloat(ing.cantidad_gr) || 0;
                
                // Cálculo de coste inicial (Sin merma)
                const coste = (cantGramos / 1000) * precioBase;

                return {
                    nombre: ing.nombre,
                    cantidad: cantGramos,
                    unidad: ing.unidad_original || 'g',
                    precio: precioBase,
                    merma: 0,              // Inicializamos para que el frontend no de error 0
                    peso_neto: cantGramos, // Inicializamos igual a la cantidad
                    coste: Number(coste.toFixed(2))
                };
            });

            const costeRacionTotal = ingredientesProcesados.reduce((acc, curr) => acc + curr.coste, 0);
            const precioCarta = parseFloat(plato.precio_venta) || 0;
            
            // Si no hay precio en carta, sugerimos uno al 30% de food cost
            const precioVentaEstimado = precioCarta > 0 ? precioCarta : Number((costeRacionTotal / 0.3).toFixed(2));
            const foodCostPct = precioCarta > 0 ? (costeRacionTotal / precioCarta) * 100 : 30;

            // 4. Guardar en la tabla escandallos (user_id eliminado)
            const { error: insErr } = await supabase.from('escandallos').insert({
                restaurante_id: restaurante_id,
                nombre_plato: plato.nombre || 'Plato importado',
                categoria: plato.categoria || 'Importado',
                precio_venta: precioVentaEstimado,
                precio_carta: precioCarta,
                coste_racion: Number(costeRacionTotal.toFixed(2)),
                food_cost_pct: Number(foodCostPct.toFixed(2)),
                ingredientes: ingredientesProcesados
            });

            if (!insErr) {
                platosGuardados++;
            } else {
                console.error(`Error guardando ${plato.nombre}:`, insErr.message);
            }
        }

        return res.status(200).json({ success: true, cantidad: platosGuardados });

    } catch (err) {
        console.error("Error crítico en la API:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

// ── LÓGICA DE EXTRACCIÓN CON CLAUDE ──
async function parseRecipeWithClaude(base64, type) {
    const isPdf = type.toLowerCase() === 'pdf';
    
    let contentBlock;
    if (isPdf) {
        contentBlock = {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 }
        };
    } else {
        const mimeType = type.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${type.toLowerCase()}`;
        contentBlock = {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 }
        };
    }

    // PROMPT CON TÉCNICA "CHAIN OF THOUGHT" PARA EVITAR QUE SE SALTE PLATOS
    const prompt = `Eres un extractor de datos de hostelería experto y meticuloso. Tu tarea es analizar TODAS las páginas de este documento y extraer CADA UNA de las recetas presentes.

INSTRUCCIÓN CRÍTICA Y OBLIGATORIA (PARA NO SALTARTE NADA):
Como el documento es largo, DEBES seguir estrictamente estos 2 pasos:
PASO 1: Primero, abre una etiqueta <analisis> y escribe una lista numerada con el nombre de TODOS los platos que ves en el documento entero, desde la página 1 hasta el final. Asegúrate de llegar hasta el último plato.
PASO 2: Cierra la etiqueta </analisis> y a continuación, genera el OBJETO JSON con todos los platos que has listado.

Estructura estricta del JSON:
{
  "platos": [
    {
      "nombre": "Nombre del Plato",
      "categoria": "Entrante/Principal/Postre",
      "precio_venta": 0.0,
      "ingredientes": [
        {"nombre": "Ingrediente", "cantidad_gr": 0, "unidad_original": "g/ml/ud"}
      ]
    }
  ]
}

REGLA: En "cantidad_gr" pon siempre el número convertido a gramos o mililitros. Ej: 1kg = 1000.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6', // Tu modelo
            max_tokens: 8192,           // Límite de salida
            temperature: 0,             // Temperatura 0 para ser metódico y literal
            messages: [{
                role: 'user',
                content: [
                    contentBlock,
                    { type: 'text', text: prompt }
                ]
            }]
        })
    });

    const data = await resp.json();
    
    if (!resp.ok) {
        throw new Error(data.error?.message || 'Error en el motor de procesamiento.');
    }
    
    const rawText = data.content[0].text;
    
    // MAGIA AQUÍ: Ignoramos la etiqueta <analisis> y cogemos SOLO desde la { hasta la }
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1) {
         throw new Error('No se pudo generar un formato de datos válido.');
    }
    
    const cleanJson = rawText.substring(startIndex, endIndex + 1);
    
    try {
        return JSON.parse(cleanJson);
    } catch (e) {
        throw new Error('Error al interpretar la estructura del documento.');
    }
}

// ── BÚSQUEDA DIFUSA DE INGREDIENTES ──
function buscarMejorCoincidencia(nombre, inventario) {
    if (!nombre) return null;
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
    const nNombre = norm(nombre);
    
    return inventario.find(p => {
        const nProv = norm(p.ingrediente_normalizado || p.ingrediente);
        if (!nProv) return false;
        return nNombre.includes(nProv) || nProv.includes(nNombre);
    });
}
