// ============================================
// SERVIDOR DE PAYTRACK - Bark con Ringtone
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE BARK
// ============================================

// Tu URL base de Bark
const BARK_BASE_URL = 'https://api.day.app/RhWJo5Dc2gLkr9ayK4RHwR';

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE BARK (iOS)');
console.log('========================================');
console.log(`📱 URL base: ${BARK_BASE_URL}`);
console.log(`🔔 Ringtone activado: ✅ Sí (sonará como llamada)`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIÓN CON RINGTONE
// ============================================

async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Validar URL
    if (!BARK_BASE_URL) {
      console.error('❌ ERROR: URL de Bark no configurada');
      return { ok: false, error: 'URL de Bark no configurada' };
    }

    // Construir el mensaje
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;
    const textoCodificado = encodeURIComponent(texto);
    
    // 🔔 1. Hacer sonar el teléfono (Ringtone)
    const ringtoneUrl = `${BARK_BASE_URL}/Ringtone?call=1`;
    console.log(`📞 Haciendo sonar el teléfono...`);
    const ringtoneRes = await fetch(ringtoneUrl);
    const ringtoneData = await ringtoneRes.json();
    
    if (ringtoneData.code !== 200) {
      console.warn(`⚠️  Ringtone: ${ringtoneData.message}`);
    } else {
      console.log(`✅ Ringtone activado`);
    }
    
    // Pequeña pausa para que suene primero
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 📱 2. Enviar el mensaje
    const mensajeUrl = `${BARK_BASE_URL}/Body/${textoCodificado}`;
    console.log(`📤 Enviando mensaje: ${mensaje.substring(0, 50)}...`);
    const mensajeRes = await fetch(mensajeUrl);
    const mensajeData = await mensajeRes.json();
    
    if (mensajeData.code === 200) {
      console.log(`✅ Notificación enviada`);
      return { ok: true };
    }
    
    console.error('❌ Error:', mensajeData);
    return { ok: false, error: mensajeData.message };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    notificaciones: "Bark con Ringtone",
    ringtone: "✅ Activado (sonará como llamada)"
  });
});

app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>PayTrack utiliza Bark para enviar notificaciones push a tu iPhone.</p>
        <p>No almacenamos información personal.</p>
        <p>Contacto: soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

app.post('/api/alexa/prueba-rapida', async (req, res) => {
  console.log('\n🧪 ========== PRUEBA RÁPIDA ==========');
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    const result = await enviarNotificacion(
      mensaje || "🔔 Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    res.json({ ok: result.ok, mensaje: result.ok ? "Notificación enviada (sonará)" : "Error" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

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
    
    setTimeout(async () => {
      console.log(`\n🔔 EJECUTANDO ALERTA: ${alertaId}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
    }, msHasta);
    
    if (url) {
      setTimeout(async () => {
        try { await fetch(url); console.log(`✅ Voice Monkey ejecutado`); } catch (e) {}
      }, msHasta);
    }
    
    res.json({ ok: true, id: alertaId, msHasta });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/disparar-ahora', async (req, res) => {
  console.log('\n⚡ ========== DISPARAR AHORA ==========');
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    const result = await enviarNotificacion(
      mensaje || "Alerta inmediata",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    if (url) await fetch(url.trim()).catch(() => {});
    res.json({ ok: result.ok });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 SERVIDOR PAYTRACK INICIADO');
  console.log('========================================');
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Bark URL: ${BARK_BASE_URL}`);
  console.log(`🔔 Ringtone: ✅ Activado (sonará como llamada)`);
  console.log(`\n🧪 PRUEBA: POST /api/alexa/prueba-rapida`);
  console.log(`   Body: {"mensaje": "Pago de tarjeta NU vence mañana"}`);
  console.log('========================================\n');
});
