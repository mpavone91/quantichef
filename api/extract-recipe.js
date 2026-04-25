import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── VERIFICACIÓN DE SESIÓN (Igual que tu extract.js) ──
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

    try {
        const { file_base64, file_type, restaurante_id } = req.body;

        // 1. Extraer recetas con Claude
        const recipes = await parseRecipeWithClaude(file_base64, file_type);
        
        // 2. Obtener precios actuales del proveedor para cruzar datos
        const { data: inventario } = await supabase
            .from('precios_proveedor')
            .select('*')
            .eq('restaurante_id', restaurante_id);

        let platosGuardados = 0;

        // 3. Procesar cada plato extraído
        for (const plato of recipes.platos) {
            const ingredientesProcesados = plato.ingredientes.map(ing => {
                const match = buscarMejorCoincidencia(ing.nombre, inventario || []);
                const precioBase = match ? parseFloat(match.precio_kg) : 0;
                
                // Calculamos coste: (cantidad_gr / 1000) * precio_kg
                const coste = (ing.cantidad_gr / 1000) * precioBase;

                return {
                    nombre: ing.nombre,
                    cantidad: ing.cantidad_gr,
                    unidad: ing.unidad_original,
                    precio: precioBase,
                    coste: Number(coste.toFixed(2))
                };
            });

            const costeRacionTotal = ingredientesProcesados.reduce((acc, curr) => acc + curr.coste, 0);
            const precioCarta = plato.precio_venta || 0;
            const foodCost = precioCarta > 0 ? (costeRacionTotal / precioCarta) * 100 : 30;

            // 4. Guardar en la tabla escandallos (Solo columnas que existen)
            const { error: insErr } = await supabase.from('escandallos').insert({
                user_id: user.id,
                restaurante_id: restaurante_id,
                nombre_plato: plato.nombre,
                categoria: plato.categoria || 'Importado',
                precio_venta: precioCarta > 0 ? precioCarta : Number((costeRacionTotal / 0.3).toFixed(2)),
                precio_carta: precioCarta,
                coste_racion: Number(costeRacionTotal.toFixed(2)),
                food_cost_pct: Number(foodCost.toFixed(2)),
                ingredientes: ingredientesProcesados
            });

            if (!insErr) platosGuardados++;
        }

        return res.status(200).json({ success: true, cantidad: platosGuardados });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// ── FUNCIONES DE APOYO ──

async function parseRecipeWithClaude(base64, type) {
    const isPdf = type.toLowerCase() === 'pdf';
    const prompt = `Eres un chef experto. Extrae los platos de este documento. Devuelve SOLO un JSON: {"platos": [{"nombre": "...", "categoria": "...", "precio_venta": 0.0, "ingredientes": [{"nombre": "...", "cantidad_gr": 0, "unidad_original": "..."}]}]}. Convierte cantidades a gramos/ml.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: [
                    { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: isPdf ? 'application/pdf' : 'image/jpeg', data: base64 } },
                    { type: 'text', text: prompt }
                ]
            }]
        })
    });

    const data = await resp.json();
    const cleanJson = data.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
}

function buscarMejorCoincidencia(nombre, inventario) {
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const nNombre = norm(nombre);
    // Búsqueda simple por palabras clave
    return inventario.find(p => {
        const nProv = norm(p.ingrediente_normalizado || p.ingrediente);
        return nNombre.includes(nProv) || nProv.includes(nNombre);
    });
}
