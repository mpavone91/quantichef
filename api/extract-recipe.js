import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.quantichef.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

    try {
        const { file_base64, file_type, restaurante_id } = req.body;

        // 1. Extraer recetas usando Claude
        const recipes = await parseRecipeWithClaude(file_base64, file_type);
        
        if (!recipes || !recipes.platos) throw new Error('No se detectaron platos.');

        // 2. Cargar inventario de precios
        const { data: inventario } = await supabase.from('precios_proveedor').select('*').eq('restaurante_id', restaurante_id);
        const inv = inventario || [];

        let platosGuardados = 0;

        for (const p of recipes.platos) {
            const ingsProcesados = (p.ingredientes || []).map(i => {
                const match = buscarMejorCoincidencia(i.n, inv);
                const pBase = match ? parseFloat(match.precio_kg) : 0;
                const cant = parseFloat(i.q) || 0;
                const coste = (cant / 1000) * pBase;

                return {
                    nombre: i.n,
                    cantidad: cant,
                    unidad: i.u || 'g',
                    precio: pBase,
                    merma: 0,
                    coste: Number(coste.toFixed(2))
                };
            });

            const costeRacion = ingsProcesados.reduce((acc, curr) => acc + curr.coste, 0);
            const pCarta = parseFloat(p.pvp) || 0;

            const { error: insErr } = await supabase.from('escandallos').insert({
                restaurante_id: restaurante_id,
                nombre_plato: p.nombre,
                categoria: p.cat || 'Importado',
                precio_venta: pCarta > 0 ? pCarta : Number((costeRacion / 0.3).toFixed(2)),
                precio_carta: pCarta,
                coste_racion: Number(costeRacion.toFixed(2)),
                food_cost_pct: pCarta > 0 ? Number(((costeRacion / pCarta) * 100).toFixed(2)) : 30,
                ingredientes: ingsProcesados
            });

            if (!insErr) platosGuardados++;
        }

        return res.status(200).json({ success: true, cantidad: platosGuardados });

    } catch (err) {
        console.error("API Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function parseRecipeWithClaude(base64, type) {
    const isTextFile = ['csv', 'txt'].includes(type.toLowerCase());
    let contentBlock;

    if (isTextFile) {
        const textContent = Buffer.from(base64, 'base64').toString('utf-8');
        contentBlock = { type: "text", text: `DATOS DEL RECETARIO:\n${textContent}` };
    } else {
        contentBlock = { 
            type: type === 'pdf' ? "document" : "image", 
            source: { type: "base64", media_type: type === 'pdf' ? "application/pdf" : "image/jpeg", data: base64 } 
        };
    }

    const prompt = `Analiza estos datos y extrae TODOS los platos. 
Devuelve SOLO un JSON con claves cortas:
{"platos": [{"nombre": "...", "cat": "Principal", "pvp": 15.5, "ingredientes": [{"n": "nombre", "q": cant_gramos, "u": "g"}]}]}
Convierte cantidades a número (gramos o ml).`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000, 
            temperature: 0,
            messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }]
        })
    });

    const data = await resp.json();
    const raw = data.content[0].text;
    const clean = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    return JSON.parse(clean);
}

function buscarMejorCoincidencia(nombre, inventario) {
    if (!nombre) return null;
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const nNombre = norm(nombre);
    return inventario.find(p => {
        const nProv = norm(p.ingrediente_normalizado || p.ingrediente);
        return nNombre.includes(nProv) || nProv.includes(nNombre);
    });
}
