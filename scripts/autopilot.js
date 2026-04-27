const { execSync } = require('child_process');

console.log("✈️ PILOTO AUTOMÁTICO INICIADO ✈️");
console.log("El ordenador debe permanecer encendido (puedes apagar la pantalla).");
console.log("---------------------------------------------------");

// Función para ejecutar el envío
function runEmailSender() {
    console.log(`\n[${new Date().toLocaleTimeString()}] Ejecutando campaña de emails...`);
    try {
        // Ejecutamos el script de envío
        execSync('node scripts/email_sender.js', { stdio: 'inherit' });
        console.log("✅ Lote enviado correctamente. Esperando al siguiente ciclo...");
    } catch (error) {
        console.error("❌ Hubo un error en la ejecución:", error.message);
    }
}

// Ejecutar la primera vez inmediatamente
runEmailSender();

// Programar para que se ejecute cada 4 horas (14400000 milisegundos)
const INTERVALO_MS = 4 * 60 * 60 * 1000; 

setInterval(runEmailSender, INTERVALO_MS);

console.log("⏰ Temporizador activado. Siguiente lote en 4 horas.");
