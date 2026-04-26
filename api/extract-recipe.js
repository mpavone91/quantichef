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

        // Validar restaurante_id antes de continuar
        if (!restaurante_id) return res.status(400).json({ error: 'Falta restaurante_id' });

        // Verificar que el restaurante pertenece al usuario
        const { data: rest, error: restErr } = await supabase
            .from('restaurantes')
            .select('id')
            .eq('id', restaurante_id)
            .eq('user_id', user.id)
            .single();

        if (restErr || !rest) return res.status(403).json({ error: 'Restaurante no encontrado o sin permisos' });

        // 1. Extraer recetas usando Claude
        const recipes = await parseRecipeWithClaude(file_base64, file_type);

        if (!recipes || !recipes.platos || recipes.platos.length === 0) {
            throw new Error('No se detectaron platos en el archivo.');
        }

        // 2. Cargar inventario de precios del proveedor
        const { data: inventario } = await supabase
            .from('precios_proveedor')
            .select('*')
            .eq('restaurante_id', restaurante_id);
        const inv = inventario || [];

        let platosGuardados = 0;
        const errores = [];

        for (const p of recipes.platos) {
            try {
                const ingsProcesados = (p.ingredientes || []).map(i => {
                    const match = buscarMejorCoincidencia(i.n, inv);
                    // Usar precio del proveedor si hay coincidencia, si no usar el del archivo
                    const pBase = match ? parseFloat(match.precio_kg) : (parseFloat(i.p) || 0);
                    const cant = parseFloat(i.q) || 0;
                    const unidad = (i.u || 'g').toLowerCase();

                    // Calcular coste según unidad: g y ml dividen entre 1000, el resto precio directo
                    let coste = 0;
                    if (unidad === 'g' || unidad === 'ml') {
                        coste = (cant / 1000) * pBase;
                    } else {
                        // kg, l, ud, ración
                        coste = cant * pBase;
                    }

                    return {
                        nombre: i.n,
                        cantidad: cant,
                        unidad: unidad,
                        precio: pBase,
                        merma: 0,
                        coste: Number(coste.toFixed(4))
                    };
                });

                // Validación defensiva de raciones:
                const racionesRaw = Math.max(1, Math.round(Math.abs(parseFloat(p.raciones) || 1)));
                const raciones = racionesRaw > 50 ? 1 : racionesRaw;

                const costeTotal = ingsProcesados.reduce((acc, curr) => acc + curr.coste, 0);
                const costeRacion = costeTotal / raciones;

                // pvp es el precio que paga el cliente en carta (€)
                const pCarta = parseFloat(p.pvp) || 0;

                // Validación defensiva de pvp
                const pCartaSafe = pCarta > 500 ? 0 : pCarta;

                // 🔥 AQUÍ ESTÁ LA MAGIA: Forzamos un número ENTERO para la base de datos
                const foodCostPct = pCartaSafe > 0
                    ? Math.round((costeRacion / pCartaSafe) * 100)
                    : 30;

                const precioVenta = pCartaSafe > 0
                    ? pCartaSafe
                    : Number((costeRacion / 0.3).toFixed(2));

                const { error: insErr } = await supabase.from('escandallos').insert({
                    restaurante_id: restaurante_id,
                    nombre_plato: p.nombre,
                    categoria: p.cat || 'Importado',
                    raciones: raciones,
                    precio_venta: precioVenta,
                    precio_carta: pCartaSafe > 0 ? pCartaSafe : null,
                    coste_total: Number(costeTotal.toFixed(4)),
                    coste_racion: Number(costeRacion.toFixed(4)),
                    food_cost_pct: foodCostPct, // <- Esto ya enviará "18" o "28" sin decimales
                    ingredientes: ingsProcesados,
                    alergenos: p.alergenos || []
                });

                if (insErr) {
                    console.error(`Error insertando "${p.nombre}":`, insErr.message);
                    errores.push(p.nombre);
                } else {
                    platosGuardados++;
                }
            } catch (platErr) {
                console.error(`Error procesando plato "${p.nombre}":`, platErr.message);
                errores.push(p.nombre);
            }
        }

        return res.status(200).json({
            success: true,
            cantidad: platosGuardados,
            errores: errores.length > 0 ? errores : undefined
        });

    } catch (err) {
        console.error('API Error extract-recipe:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function parseRecipeWithClaude(base64, type) {
    const typeLower = (type || '').toLowerCase();
    const isTextFile = ['csv', 'txt'].includes(typeLower);
    let contentBlock;

    if (isTextFile) {
        const textContent = Buffer.from(base64, 'base64').toString('utf-8');
        contentBlock = {
            type: 'text',
            text: `DATOS DEL RECETARIO:\n${textContent}`
        };
    } else if (typeLower === 'pdf') {
        contentBlock = {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
        };
    } else {
        // imagen (jpg, png, webp...)
        contentBlock = {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
        };
    }

    const prompt = `Eres un asistente experto en hostelería. Analiza el archivo y extrae TODOS los platos.

CAMPOS QUE DEBES IDENTIFICAR POR PLATO:
- "nombre": nombre del plato (texto)
- "cat": categoría — Entrante, Principal, Postre o Bebida (si no está, infiere por el tipo de plato)
- "pvp": precio de VENTA AL CLIENTE en carta (lo que paga el comensal, en €). Si no aparece, pon 0
- "raciones": número de PORCIONES o RACIONES que salen de esta receta. Siempre es un número entero pequeño (1, 2, 4, 10...). NUNCA es un precio ni un gramaje
- "ingredientes": lista de materias primas con:
  - "n": nombre del ingrediente
  - "q": cantidad numérica (solo el número, sin unidad)
  - "u": unidad — usa solo: g, kg, ml, l, ud, ración
  - "p": precio de COMPRA al proveedor por kg o por unidad (lo que paga el restaurante, en €). Si no aparece, pon 0

REGLAS CRÍTICAS PARA NO CONFUNDIR CAMPOS:
- "pvp" y "p" son PRECIOS EN EUROS — números con decimales como 14.50
- "raciones" es una CANTIDAD DE PORCIONES — número entero pequeño como 1, 2, 4, 10
- "q" es una CANTIDAD DE INGREDIENTE — puede ser 200 (gramos), 1.5 (kg), etc.
- NUNCA pongas un precio en el campo "raciones"
- NUNCA pongas un gramaje o cantidad en un campo de precio
- Si una columna se llama "precio_carta", "pvp", "precio venta" o similar → va en "pvp"
- Si una columna se llama "raciones", "porciones", "comensales" o similar → va en "raciones"
- Si un valor no aparece claramente en el archivo, usa el valor por defecto: 0 para precios, 1 para raciones

El archivo puede venir en CUALQUIER formato: CSV, Excel exportado, texto plano, tabla, lista, PDF, notas de cocina, etc.
Tu trabajo es interpretar la estructura como lo haría un humano, sea cual sea el formato.

Devuelve SOLO JSON válido sin texto adicional ni bloques de código markdown:
{"platos":[{"nombre":"...","cat":"Principal","pvp":14.50,"raciones":1,"ingredientes":[{"n":"...","q":200,"u":"g","p":4.80}]}]}`;

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
            messages: [{
                role: 'user',
                content: [
                    contentBlock,
                    { type: 'text', text: prompt }
                ]
            }]
        })
    });

    if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(`Claude API error: ${errData.error?.message || resp.status}`);
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text || '';

    // Extracción robusta del JSON aunque venga con texto alrededor
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('Claude no devolvió JSON válido');
    }

    const clean = raw.substring(firstBrace, lastBrace + 1);
    return JSON.parse(clean);
}

function buscarMejorCoincidencia(nombre, inventario) {
    if (!nombre || inventario.length === 0) return null;

    const norm = (s) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const nNombre = norm(nombre);

    // Búsqueda exacta primero
    let match = inventario.find(p => {
        const nProv = norm(p.ingrediente_normalizado || p.ingrediente || '');
        return nProv === nNombre;
    });

    // Si no hay exacta, búsqueda por palabras clave (mínimo 4 letras)
    if (!match) {
        match = inventario.find(p => {
            const nProv = norm(p.ingrediente_normalizado || p.ingrediente || '');
            if (!nProv || nProv.length < 3) return false;
            const palabrasNombre = nNombre.split(' ').filter(w => w.length >= 4);
            const palabrasProv = nProv.split(' ').filter(w => w.length >= 4);
            if (palabrasNombre.length === 0 || palabrasProv.length === 0) return false;
            return palabrasNombre.every(w => nProv.includes(w)) ||
                   palabrasProv.every(w => nNombre.includes(w));
        });
    }

    return match || null;
}
