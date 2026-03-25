// ============================================
// SERVIDOR DE PAYTRACK - Bark (Ringtone + Body) + Voice Monkey
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE BARK (iPhone)
// ============================================

// Tu URL única de Bark (cópiala de la app en tu iPhone)
const BARK_BASE_URL = 'https://api.day.app/RhWJo5Dc2gLkr9ayK4RHwR';

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE BARK');
console.log('========================================');
console.log(`📱 URL base: ${BARK_BASE_URL}`);
console.log(`🔔 Ringtone: Activado (sonará como llamada)`);
console.log(`📝 Body: Activado (mostrará el mensaje)`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIÓN A IPHONE (Bark)
// ============================================

/**
 * Envía notificación push al iPhone usando Bark
 * - Primero hace sonar el teléfono (Ringtone)
 * - Luego envía el mensaje (Body)
 */
async function enviarNotificacionBark(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Construir el mensaje completo
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;
    
    // Limpiar texto (eliminar acentos y caracteres especiales)
    const textoLimpio = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\n:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const textoCodificado = encodeURIComponent(textoLimpio);
    
    // 1. Hacer sonar el teléfono (Ringtone)
    const ringtoneUrl = `${BARK_BASE_URL}/Ringtone?call=1`;
    console.log(`📞 Haciendo sonar el iPhone...`);
    await fetch(ringtoneUrl);
    
    // Pequeña pausa para que suene primero
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 2. Enviar el mensaje (Body)
    const bodyUrl = `${BARK_BASE_URL}/Body/${textoCodificado}`;
    console.log(`📤 Enviando mensaje: ${mensaje.substring(0, 50)}...`);
    const response = await fetch(bodyUrl);
    const result = await response.json();
    
    if (result.code === 200) {
      console.log(`✅ Notificación Bark enviada (sonó y llegó mensaje)`);
      return { ok: true };
    }
    
    console.error(`❌ Error Bark: ${result.message}`);
    return { ok: false, error: result.message };
    
  } catch (error) {
    console.error('❌ Error en Bark:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// FUNCIÓN PARA DISPARAR VOICE MONKEY (Alexa)
// ============================================

/**
 * Dispara Voice Monkey para que Alexa anuncie
 */
async function dispararVoiceMonkey(url) {
  if (!url) return false;
  try {
    console.log(`🔊 Disparando Voice Monkey...`);
    const response = await fetch(url);
    console.log(`✅ Voice Monkey ejecutado (status: ${response.status})`);
    return true;
  } catch (error) {
    console.error(`❌ Error Voice Monkey: ${error.message}`);
    return false;
  }
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * Endpoint principal - Estado del servidor
 */
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    bark: "Ringtone + Body",
    voice_monkey: "Activado"
  });
});

/**
 * Política de privacidad
 */
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>PayTrack utiliza Bark para enviar notificaciones push a tu iPhone y Voice Monkey para anuncios en Alexa.</p>
        <p>No almacenamos información personal.</p>
        <p>Contacto: soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

/**
 * PRUEBA RÁPIDA - Envía notificación inmediata (Bark + Voice Monkey)
 */
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  console.log('\n🧪 ========== PRUEBA RÁPIDA ==========');
  try {
    const { mensaje, urlVoiceMonkey } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    console.log(`📝 Mensaje: ${mensaje || "Prueba de PayTrack"}`);
    
    // Enviar notificación a iPhone (Bark)
    const barkResult = await enviarNotificacionBark(
      mensaje || "🔔 Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    // Disparar Voice Monkey si se proporcionó URL
    let voiceResult = false;
    if (urlVoiceMonkey) {
      voiceResult = await dispararVoiceMonkey(urlVoiceMonkey);
    }
    
    res.json({ 
      ok: barkResult.ok, 
      mensaje: "Notificación enviada",
      bark: barkResult.ok,
      voice_monkey: voiceResult
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
    
    if (!fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan datos: fecha, hora" });
    }
    
    const fechaHoraProgramada = new Date(`${fecha}T${hora}:00-06:00`);
    const ahora = new Date();
    
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({ ok: false, error: "Fecha/hora ya pasó" });
    }
    
    const textoMensaje = mensaje || `Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`;
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    console.log(`⏱️  Programado para dentro de ${Math.round(msHasta/1000)} segundos`);
    console.log(`🆔 ID: ${alertaId}`);
    
    // Programar la notificación de Bark
    setTimeout(async () => {
      console.log(`\n🔔 EJECUTANDO ALERTA PROGRAMADA: ${alertaId}`);
      console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
      await enviarNotificacionBark(textoMensaje, fecha, hora, tarjeta);
    }, msHasta);
    
    // Programar Voice Monkey si se proporcionó URL
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
      msHasta,
      mensaje: `Alerta programada para ${fecha} ${hora}`
    });
  } catch (error) {
    console.error('Error en /programar:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DISPARAR AHORA - Envía alerta inmediata (Bark + Voice Monkey)
 */
app.post('/api/voice/disparar-ahora', async (req, res) => {
  console.log('\n⚡ ========== DISPARAR AHORA ==========');
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    console.log(`📝 Mensaje: ${mensaje || "Alerta inmediata"}`);
    
    // Enviar notificación a iPhone (Bark)
    const barkResult = await enviarNotificacionBark(
      mensaje || "🔔 Alerta inmediata de PayTrack",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    // Disparar Voice Monkey si se proporcionó URL
    let voiceResult = false;
    if (url) {
      voiceResult = await dispararVoiceMonkey(url);
    }
    
    console.log(`📊 Resultados: Bark: ${barkResult.ok ? '✅' : '❌'}, Voice Monkey: ${voiceResult ? '✅' : '❌'}`);
    console.log('========================================\n');
    
    res.json({ 
      ok: barkResult.ok, 
      bark: barkResult.ok,
      voice_monkey: voiceResult
    });
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
  console.log(`📱 Bark: Ringtone + Body`);
  console.log(`🔊 Voice Monkey: Activado`);
  console.log(`\n🔔 ENDPOINTS DISPONIBLES:`);
  console.log(`   POST /api/voice/disparar-ahora  - Alerta inmediata (Bark + Voice Monkey)`);
  console.log(`   POST /api/voice/programar       - Programar alerta futura`);
  console.log(`   POST /api/alexa/prueba-rapida   - Prueba rápida`);
  console.log(`   GET  /privacy                   - Política de privacidad`);
  console.log(`   GET  /                          - Estado del servidor`);
  console.log('========================================\n');
});
