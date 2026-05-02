// Script de importación de leads a Supabase
// Ejecutar: node scripts/import-leads.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://ilzntryzijdfnntwuthp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH = process.env.CSV_PATH || 'C:/Users/Massimo/Downloads/Leads - Sheet1.csv';

if (!SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY. Pásala como variable de entorno.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Palabras clave para segmentar
const SEGMENTO_A = ['propietario','owner','co-owner','co owner','business owner','ceo','chef y propietario','chef and co-owner','creador y propietario','fundador','founder','gerente y propietario','empresario'];
const SEGMENTO_B = ['f&b','food and beverage','food & beverage','jefe de operaciones','jefe de cocina','operations manager','gerente de operaciones','responsable de operaciones','operaciones','culinary','f&b manager','restaurant manager'];
const BAJA_PRIORIDAD = ['tui','intercruises','marriott corporate','mcdonald','kfc','subway corporate','royal caribbean','sodexo','newrest'];

function segmentar(cargo, empresa) {
  const c = (cargo || '').toLowerCase();
  const e = (empresa || '').toLowerCase();
  if (BAJA_PRIORIDAD.some(bp => e.includes(bp))) return 'C';
  if (SEGMENTO_A.some(k => c.includes(k))) return 'A';
  if (SEGMENTO_B.some(k => c.includes(k))) return 'B';
  return 'C';
}

function parsearCSV(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').slice(1);
  const contactos = [];
  const emailsVistos = new Set();

  for (const linea of lineas) {
    if (!linea.trim()) continue;

    // Parsear CSV respetando comillas
    const cols = [];
    let campo = '', enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') { enComillas = !enComillas; }
      else if (ch === ',' && !enComillas) { cols.push(campo.trim()); campo = ''; }
      else { campo += ch; }
    }
    cols.push(campo.trim());

    const [nombre, apellidos, cargo, empresa, email] = cols;

    // Filtrar inválidos
    if (!email || email === 'nan' || !email.includes('@')) continue;
    const emailLower = email.toLowerCase().trim();
    if (emailsVistos.has(emailLower)) continue;
    emailsVistos.add(emailLower);

    const segmento = segmentar(cargo || '', empresa || '');

    contactos.push({
      nombre: (nombre || '').trim(),
      apellidos: (apellidos || '').trim(),
      cargo: (cargo || '').trim(),
      empresa: (empresa || '').trim(),
      email: emailLower,
      segmento,
      estado: 'pendiente'
    });
  }
  return contactos;
}

async function main() {
  console.log('📂 Leyendo CSV:', CSV_PATH);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ No se encontró el archivo:', CSV_PATH);
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const contactos = parsearCSV(csv);

  const porSegmento = { A: 0, B: 0, C: 0 };
  contactos.forEach(c => porSegmento[c.segmento]++);

  console.log(`\n✅ ${contactos.length} contactos válidos (sin duplicados, sin emails inválidos)`);
  console.log(`   🔴 Segmento A — Propietarios/CEOs: ${porSegmento.A} personas`);
  console.log(`   🔵 Segmento B — F&B/Operaciones:   ${porSegmento.B} personas`);
  console.log(`   ⚪ Segmento C — Otros/Hotels:       ${porSegmento.C} personas`);
  console.log('\n📤 Importando a Supabase...\n');

  // Insertar en lotes de 50
  const TAM_LOTE = 50;
  let insertados = 0;
  let errores = 0;

  for (let i = 0; i < contactos.length; i += TAM_LOTE) {
    const lote = contactos.slice(i, i + TAM_LOTE);
    const { error } = await sb
      .from('campana_contactos')
      .upsert(lote, { onConflict: 'email' });
    
    if (error) {
      console.error(`   ❌ Error en lote ${i}-${i + TAM_LOTE}:`, error.message);
      errores += lote.length;
    } else {
      insertados += lote.length;
      process.stdout.write(`\r   ✓ Procesados: ${insertados}/${contactos.length}`);
    }
  }

  console.log(`\n\n🎉 Importación completa:`);
  console.log(`   ✅ ${insertados} contactos insertados/actualizados`);
  if (errores > 0) console.log(`   ❌ ${errores} con errores`);
  console.log(`\n👉 Ahora ve a https://www.quantichef.com/campaign para enviar la campaña`);
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
