// Script de importación de leads ePack (Segmento D)
// Ejecutar: node scripts/import-epack.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ilzntryzijdfnntwuthp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) { console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Leads extraídos manualmente de las fotos ePack
// Omitidos: emails ilegibles, no hostelería (PSA Peugeot, Atlético de Madrid,
//           Ayuntamiento, Universidad, Diseñador Gráfico, Banda Municipal,
//           El Corte Inglés, Quandum Aerospace, Massimo Pavone)
// ─────────────────────────────────────────────────────────────────────────────
const LEADS_EPACK = [
  // ── Imagen 1 ──────────────────────────────────────────────────────────────
  { nombre:'Mónica',      apellidos:'Zayas Albelda',          cargo:'Propietaria',                empresa:'Pa i Dolços Mónica',              email:'monica.panaderia@hotmail.com' },
  { nombre:'Denisse',     apellidos:'Sanchez Galera',         cargo:'Responsable',                empresa:'Restaurante Rosa\'s',             email:'restauranterosas1994@gmail.com' },
  { nombre:'Rosa Virginia',apellidos:'Arredondo Luna',        cargo:'Propietaria',                empresa:'Kitchen Sazón S.L.',              email:'vicki318149@gmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'Restaurante El Perejil',          email:'cbr600es@yahoo.es' },
  { nombre:'Ana',         apellidos:'Núñez Navarro',          cargo:'',                           empresa:'Núñez i Navarro Hotels',          email:'agregornn@nnhotels.com' },
  { nombre:'Gaby Nathaly',apellidos:'Chamorro Jaime',         cargo:'Propietaria',                empresa:'Gaby Nathaly Chamorro Jaime',     email:'natalygabriela1980@gmail.com' },
  { nombre:'Mariset Niña',apellidos:'Crespo Gómez',          cargo:'Responsable',                empresa:'Bahia Honda',                     email:'marisetorespogomes@yahoo.es' },
  { nombre:'Ana',         apellidos:'Garcia',                 cargo:'',                           empresa:'La Parrilla de San Lorenzo',      email:'restaurante@laparrilladesanlorenzo.es' },
  { nombre:'Joaquim',     apellidos:'Meca',                   cargo:'',                           empresa:'Andante Hotels',                  email:'cocina@andantehotel.com' },
  { nombre:'Julio',       apellidos:'Tapia',                  cargo:'',                           empresa:'Hermanos Tapia',                  email:'julbyndy@gmail.com' },
  { nombre:'Juan',        apellidos:'Calvo',                  cargo:'',                           empresa:'GL Hostelería Tres Cantos SL',    email:'juancalvo1988@gmail.com' },
  { nombre:'Francisco',   apellidos:'Miguel',                 cargo:'',                           empresa:'Nautica Alquivent',               email:'alquivent@alquivent.com' },
  { nombre:'Leonidas',    apellidos:'',                       cargo:'',                           empresa:'Restaurante Casa Leonidas',       email:'casaleonidas@hotmail.com' },

  // ── Imagen 2 ──────────────────────────────────────────────────────────────
  { nombre:'Mohammad',    apellidos:'Sajad',                  cargo:'',                           empresa:'Iraf Foods',                      email:'mohammedsajad0@gmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'El Jardinet Secret',              email:'eljardinetsecret@gmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'Restaurante Mariana Grill',       email:'carlossgolor2000@gmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'La Amsteleria',                   email:'amsteleria@gmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'Restaurante El Chato',            email:'eva@restauranteelchato.com' },
  { nombre:'Stalin',      apellidos:'De La Cruz',             cargo:'',                           empresa:'El Paraiso',                      email:'stalindelacruz.gomez28@gmail.com' },
  { nombre:'Yolanda',     apellidos:'Garcia Berbes',          cargo:'Propietaria',                empresa:'A de Yoli',                       email:'garciaberbesby@gmail.com' },
  { nombre:'Jose',        apellidos:'Perez',                  cargo:'',                           empresa:'Gastrobar La Cuba',               email:'gastrobarlacuba@gmail.com' },
  { nombre:'Santi',       apellidos:'',                       cargo:'',                           empresa:'Santi',                           email:'santycane@hotmail.com' },
  { nombre:'Pablo',       apellidos:'Ruiz Martin',            cargo:'',                           empresa:'Inspiral',                        email:'inspiral@hotmail.com' },
  { nombre:'Sandra',      apellidos:'Chinchilema',            cargo:'',                           empresa:'Can Limas',                       email:'sancs5@hotmail.com' },
  { nombre:'Veronica',    apellidos:'Castro Fernández',       cargo:'',                           empresa:'Socastro de',                     email:'veronicasmo301@gmail.com' },

  // ── Imagen 3 ──────────────────────────────────────────────────────────────
  { nombre:'Yehri',       apellidos:'Moreno',                 cargo:'',                           empresa:'En La Fabrica de Media Hora',     email:'lacabera35@hotmail.com' },
  { nombre:'',            apellidos:'',                       cargo:'',                           empresa:'Café D\'Moran',                   email:'cafdimoran@gmail.com' },
  { nombre:'Tomas',       apellidos:'Losada Reyes',           cargo:'',                           empresa:'Restaurante Peña Flamenca',       email:'losadareyestomas@gmail.com' },
  { nombre:'Javier',      apellidos:'Uceda Prieto',           cargo:'',                           empresa:'',                               email:'javierucedaprieto@gmail.com' },
  { nombre:'Jesús',       apellidos:'Lemos',                  cargo:'',                           empresa:'Chiringuito Hoyo 19',             email:'jesuslemos671@gmail.com' },
  { nombre:'Eric',        apellidos:'Esteve',                 cargo:'',                           empresa:'Nass',                            email:'pankesteve@gmail.com' },
  { nombre:'Raul',        apellidos:'Molero',                 cargo:'',                           empresa:'CLA',                             email:'raulmoleroo2000@gmail.com' },
  { nombre:'Martin',      apellidos:'Segura',                 cargo:'',                           empresa:'Velasco y Rubio',                 email:'marseg78@live.com' },
  { nombre:'Jose Luis',   apellidos:'',                       cargo:'',                           empresa:'Juanito Baker',                   email:'jlperez2@juanitobaker.com' },
  { nombre:'Juany',       apellidos:'Lopez Jurado',           cargo:'',                           empresa:'Jovianes',                        email:'juany@jovianes.es' },

  // ── Imagen 4 ──────────────────────────────────────────────────────────────
  { nombre:'Fernando',    apellidos:'Pacheco',                cargo:'',                           empresa:'Alimentos La Especia',            email:'fernando@laespecia.com' },
  { nombre:'Iztiar',      apellidos:'Garcia',                 cargo:'',                           empresa:'Grupo Pasion',                    email:'info@grupopasion.com' },
  { nombre:'Andres',      apellidos:'Garrido',                cargo:'',                           empresa:'Doña Blanca',                     email:'andres@panissimo.es' },
  { nombre:'Tahiana',     apellidos:'Colomer',                cargo:'',                           empresa:'Aura Burgers',                    email:'tahaniacolomer@bitaurum.net' },
  { nombre:'Jose A.',     apellidos:'Supervia',               cargo:'',                           empresa:'Setas Supervia',                  email:'setassupervia@telefonica.net' },
  { nombre:'Nuria',       apellidos:'Gomez',                  cargo:'',                           empresa:'La Piemontesa',                   email:'nurias@lapiemontessa.com' },
  { nombre:'Jacob',       apellidos:'Corral',                 cargo:'',                           empresa:'Core Restauracion',               email:'jcorral@corerestauracion.com' },
  { nombre:'Manuel',      apellidos:'Centeno Ramos',          cargo:'',                           empresa:'Elgamodelpardo',                  email:'centenmoytu@gmail.com' },
  { nombre:'Jorge',       apellidos:'Illana',                 cargo:'',                           empresa:'Esprisa Gourmet',                 email:'jorgeillana@distribucioneslavi.com' },
  { nombre:'Jesús Félix', apellidos:'Sevilla Gonzalez',       cargo:'',                           empresa:'Hermanos Masa',                   email:'jfelixsevilla@hotmail.com' },
  { nombre:'Sergio',      apellidos:'Rama Villar',            cargo:'',                           empresa:'Canela en Rama',                  email:'acturdako@gmail.com' },
  { nombre:'Maria',       apellidos:'Rodriguez',              cargo:'',                           empresa:'Traband Restauracion',            email:'mariar@badesea.es' },

  // ── Imagen 5 ──────────────────────────────────────────────────────────────
  { nombre:'Antonio',     apellidos:'Martinez',               cargo:'',                           empresa:'Pescados Martínez',               email:'antoniomartinez39@gmail.com' },
  { nombre:'Macarena',    apellidos:'Alvarado',               cargo:'',                           empresa:'Taconeo Malagueño SL',            email:'macarena.alvarado1@gmail.com' },
  { nombre:'Carlos',      apellidos:'Sarmiento Martin',       cargo:'',                           empresa:'Al Andalus Palace',               email:'sarmiento.ma96@hotmail.com' },
  { nombre:'Loli',        apellidos:'Gómez',                  cargo:'',                           empresa:'En La Fabrica del Té',            email:'loli-go@hotmail.com' },
  { nombre:'Juan Manuel', apellidos:'Dalessandro',            cargo:'',                           empresa:'Motteau',                         email:'jmda14@gmail.com' },
  { nombre:'Jimy',        apellidos:'Garcés',                 cargo:'',                           empresa:'Ceferino',                        email:'jimygarces0@gmail.com' },
  { nombre:'Fadel',       apellidos:'Annous',                 cargo:'',                           empresa:'Fadel',                           email:'fadelannous84@gmail.com' },
];

async function main() {
  const leads = LEADS_EPACK
    .filter(l => l.email && l.email.includes('@'))
    .map(l => ({ ...l, segmento: 'D', estado: 'pendiente' }));

  console.log(`\n📸 Leads extraídos de fotos ePack: ${leads.length}`);
  console.log('📤 Importando a Supabase como Segmento D...\n');

  const TAM_LOTE = 50;
  let ok = 0, err = 0;

  for (let i = 0; i < leads.length; i += TAM_LOTE) {
    const lote = leads.slice(i, i + TAM_LOTE);
    const { error } = await sb.from('campana_contactos').upsert(lote, { onConflict: 'email' });
    if (error) { console.error('❌ Error:', error.message); err += lote.length; }
    else { ok += lote.length; process.stdout.write(`\r   ✓ Procesados: ${ok}/${leads.length}`); }
  }

  console.log(`\n\n🎉 Hecho: ${ok} leads ePack (Seg. D) en Supabase`);
  if (err) console.log(`   ❌ ${err} con errores`);
  
  // Mostrar los que no se pudieron extraer
  console.log(`\n⚠️  Emails NO extraídos por ser ilegibles en las fotos:`);
  console.log('   Jorge Ezquerra (Isonor), Pere Morales (La Vermutería),');
  console.log('   Yami (Pan l\'Canella), Jose Molero (Arte Latte),');
  console.log('   Gricelda Caballero (Casa Andalucia), Irene Beatriz Gil (Cesteiro),');
  console.log('   Thalia Carrero (Bomba SL), Hotel La Glorieta,');
  console.log('   Ohana Restaurant Sitges, Rosa Aguirre (Brasas Perliana),');
  console.log('   Andres Cayetano (Ancaf), Maria del Mar Salgado (MaxKM),');
  console.log('   Marta (Bar Carlos), Antonio Romero (Myshaykokoro),');
  console.log('   Adriana Villanueva (Crazy Churros), Jose Alejandro Martinez,');
  console.log('   Elisa Aparisi (Antonio y Guillermina), Cafebar Papiro/Lola,');
  console.log('   Cipriano LG, Sico (Atletico Madrid - skip),');
  console.log('   Arturo Llanos (Univ. Mediterráneo - skip),');
  console.log('   Jose Antonio (Restaurante Antonio - no email visible),');
  console.log('   Susi (Restaurant Xabec), Marga (Balco de Cabrera),');
  console.log('   Amor Lopez (El Camerino Ruzafa), Miriam Garcia,');
  console.log('   Luz Sanchez (Amazonia), Amelia Ortiz, Karinne Gisberti,');
  console.log('   Dita Dezhínskaia (Art-Bar El Gos Perdut)');
  console.log('\n👉 Si puedes pasarme un CSV o texto de estos, los añado al momento.');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
