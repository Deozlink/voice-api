// ============================================
// SERVIDOR DE PAYTRACK - Notificaciones con Bark (iOS)
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE BARK
// ============================================

// 📱 URL que obtienes de la app Bark en tu iPhone
// Pasos:
// 1. Descarga "Bark - Custom Notifications" desde la App Store
// 2. Abre la app y copia tu URL única (ej: https://api.day.app/tu-clave-unica)
const BARK_URL = 'https://api.day.app/tu-clave-unica'; // ← REEMPLAZA CON TU URL

// Verificar configuración
if (!BARK_URL || BARK_URL === 'https://api.day.app/tu-clave-unica') {
  console.warn('⚠️  ADVERTENCIA: No has configurado tu URL de Bark');
  console.warn('   1. Descarga la app "Bark" en tu iPhone');
  console.warn('   2. Abre la app y copia tu URL única');
  console.warn('   3. Reemplaza BARK_URL en este archivo');
}

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE BARK (iOS)');
console.log('========================================');
console.log(`📱 URL configurada: ${BARK_URL !== 'https://api.day.app/tu-clave-unica' ? '✅' : '❌ pendiente'}`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIONES A iOS
// ============================================

/**
 * Envía una notificación push al iPhone usando Bark
 * @param {string} mensaje - Texto principal de la notificación
 * @param {string} fecha - Fecha (YYYY-MM-DD)
 * @param {string} hora - Hora (HH:MM)
 * @param {string} tarjeta - Nombre de la tarjeta (opcional)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Validar que la URL está configurada
    if (!BARK_URL || BARK_URL === 'https://api.day.app/tu-clave-unica') {
      console.error('❌ ERROR: URL de Bark no configurada');
      return { ok: false, error: 'URL de Bark no configurada. Descarga la app Bark en tu iPhone.' };
    }

    // Construir el mensaje
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;
    
    // Codificar el texto para la URL
    const textoCodificado = encodeURIComponent(texto);
    
    // URL completa de Bark
    const url = `${BARK_URL}/${textoCodificado}`;
    
    console.log(`📤 Enviando notificación a iOS...`);
    console.log(`   Mensaje: ${mensaje.substring(0, 50)}...`);

    // Enviar la petición
    const response = await fetch(url);
    const result = await response.json();

    console.log(`📥 Respuesta: code ${result.code}`);

    if (response.ok && result.code === 200) {
      console.log('✅ Notificación enviada correctamente a tu iPhone');
      return { ok: true };
    }
    
    console.error('❌ Error Bark:', result);
    return { ok: false, error: result.message || 'Error al enviar' };
    
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

/**
 * Endpoint principal - Estado del servidor
 */
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    notificaciones: "Bark (iOS)",
    url_configurada: BARK_URL !== 'https://api.day.app/RhWJo5Dc2gLkr9ayK4RHwR/Body',
    instrucciones: "Descarga la app Bark en tu iPhone y suscríbete con tu URL"
  });
});

/**
 * Política de privacidad
 */
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Política de Privacidad - PayTrack</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          h2 { color: #34495e; margin-top: 20px; }
          .date { color: #7f8c8d; font-size: 0.9em; margin-bottom: 20px; }
          footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.8em; color: #7f8c8d; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Política de Privacidad - PayTrack</h1>
        <div class="date">Última actualización: 24 de marzo de 2026</div>
        
        <h2>1. Información que recopilamos</h2>
        <p>PayTrack es una aplicación de gestión de pagos con tarjetas de crédito. Para funcionar, utilizamos Bark para enviar notificaciones push a tu iPhone.</p>
        <p><strong>No almacenamos información personal.</strong> Los datos de tus pagos (tarjeta, fecha, hora) se procesan únicamente para enviar la notificación.</p>
        
        <h2>2. Cómo usamos tu información</h2>
        <p>La información que recopilamos se utiliza exclusivamente para:</p>
        <ul>
          <li>Programar recordatorios de pago en la fecha y hora que selecciones</li>
          <li>Enviar notificaciones push a tu iPhone a través de Bark</li>
        </ul>
        
        <h2>3. Seguridad</h2>
        <p>Las comunicaciones con Bark son encriptadas mediante HTTPS. Tu URL única de Bark es privada y solo la conoces tú y este servidor.</p>
        
        <h2>4. Tus derechos</h2>
        <p>Puedes revocar el acceso de PayTrack a tus notificaciones en cualquier momento desde la app Bark o eliminando tu URL.</p>
        
        <h2>5. Contacto</h2>
        <p>Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en: <strong>soporte@paytrack.com</strong></p>
        
        <footer>
          <p>PayTrack - Gestión de pagos con tarjetas de crédito</p>
        </footer>
      </body>
    </html>
  `);
});

// ============================================
// ENDPOINTS DE PRUEBA Y PROGRAMACIÓN
// ============================================

/**
 * PRUEBA RÁPIDA - Envía una notificación inmediata
 * Útil para verificar que todo funciona
 */
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  console.log('\n🧪 ========== PRUEBA RÁPIDA ==========');
  
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    
    const result = await enviarNotificacion(
      mensaje || "🔔 Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    res.json({ 
      ok: result.ok, 
      mensaje: result.ok ? "Notificación enviada a tu iPhone" : "Error",
      detalle: result 
    });
  } catch (error) {
    console.error('Error en prueba rápida:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PROGRAMAR ALERTA - Crea un recordatorio programado
 * Se ejecuta en la fecha y hora especificadas
 */
app.post('/api/voice/programar', async (req, res) => {
  console.log('\n📅 ========== PROGRAMAR ALERTA ==========');
  
  try {
    const { url, fecha, hora, tarjeta, mensaje, id } = req.body;
    
    // Validar datos requeridos
    if (!fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan datos: fecha, hora" });
    }
    
    // Verificar que la fecha/hora sea futura
    const fechaHoraProgramada = new Date(`${fecha}T${hora}:00-06:00`);
    const ahora = new Date();
    
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({ ok: false, error: "Fecha/hora ya pasó" });
    }
    
    // Preparar mensaje
    const textoMensaje = mensaje || `Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`;
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    console.log(`⏱️  Tiempo hasta ejecución: ${Math.round(msHasta/1000)} segundos`);
    console.log(`🆔 ID: ${alertaId}`);
    
    // Programar la notificación de Bark
    setTimeout(async () => {
      console.log(`\n🔔 ========== EJECUTANDO ALERTA PROGRAMADA ==========`);
      console.log(`🆔 ID: ${alertaId}`);
      console.log(`📅 Fecha: ${fecha} ${hora}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
      console.log(`========================================\n`);
    }, msHasta);
    
    // Voice Monkey como respaldo (si se proporcionó URL)
    if (url) {
      setTimeout(async () => {
        try { 
          await fetch(url); 
          console.log(`✅ Voice Monkey ejecutado para ${alertaId}`);
        } catch (e) {
          console.error(`❌ Error Voice Monkey: ${e.message}`);
        }
      }, msHasta);
    }
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta,
      mensaje: `Notificación programada para ${fecha} ${hora}`
    });
    
  } catch (error) {
    console.error("Error en /programar:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DISPARAR AHORA - Envía una alerta inmediata
 * Útil para pruebas o emergencias
 */
app.post('/api/voice/disparar-ahora', async (req, res) => {
  console.log('\n⚡ ========== DISPARAR AHORA ==========');
  
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    
    // Enviar notificación inmediata
    const result = await enviarNotificacion(
      mensaje || "Alerta inmediata de PayTrack",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    // Voice Monkey si se proporcionó URL
    if (url) {
      await fetch(url.trim()).catch(e => console.error('Voice Monkey falló:', e.message));
    }
    
    console.log(`📊 Resultado: ${result.ok ? 'ÉXITO' : 'FALLO'}`);
    console.log('========================================\n');
    
    res.json({ ok: result.ok, mensaje: result.ok ? "Alerta enviada" : "Error" });
  } catch (error) {
    console.error('Error en disparar-ahora:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 SERVIDOR PAYTRACK INICIADO');
  console.log('========================================');
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Notificaciones: Bark (iOS)`);
  console.log(`📱 URL Bark: ${BARK_URL !== 'https://api.day.app/tu-clave-unica' ? '✅ CONFIGURADA' : '❌ PENDIENTE'}`);
  console.log(`\n🔧 PARA CONFIGURAR BARK:`);
  console.log(`   1. Descarga la app "Bark" en tu iPhone (App Store)`);
  console.log(`   2. Abre la app y copia tu URL única`);
  console.log(`   3. Reemplaza BARK_URL en este archivo con tu URL`);
  console.log(`   4. Vuelve a desplegar en Render`);
  console.log(`\n🧪 PRUEBA RÁPIDA: POST /api/alexa/prueba-rapida`);
  console.log(`   Body: {"mensaje": "Hola desde PayTrack"}`);
  console.log('========================================\n');
});
