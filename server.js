// ============================================
// SERVIDOR DE PAYTRACK - Bark con Ringtone + Body
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BARK_BASE_URL = 'https://api.day.app/RhWJo5Dc2gLkr9ayK4RHwR';

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE BARK');
console.log('========================================');
console.log(`📱 URL base: ${BARK_BASE_URL}`);
console.log(`🔔 Ringtone: Activado`);
console.log(`📝 Body: Activado`);
console.log('========================================\n');

async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;
    
    const textoLimpio = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\n:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const textoCodificado = encodeURIComponent(textoLimpio);
    
    // 1. Ringtone
    const ringtoneUrl = `${BARK_BASE_URL}/Ringtone?call=1`;
    console.log(`📞 Haciendo sonar el teléfono...`);
    await fetch(ringtoneUrl);
    
    // Pausa
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 2. Body
    const bodyUrl = `${BARK_BASE_URL}/Body/${textoCodificado}`;
    console.log(`📤 Enviando mensaje: ${mensaje.substring(0, 50)}...`);
    const response = await fetch(bodyUrl);
    const result = await response.json();
    
    if (result.code === 200) {
      console.log(`✅ Notificación completa`);
      return { ok: true };
    }
    
    return { ok: false, error: result.message };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando", bark: "Ringtone + Body" });
});

app.get('/privacy', (req, res) => {
  res.send(`<html><body><h1>Política de Privacidad</h1><p>PayTrack utiliza Bark para notificaciones.</p></body></html>`);
});

app.post('/api/alexa/prueba-rapida', async (req, res) => {
  console.log('\n🧪 PRUEBA RÁPIDA');
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    const result = await enviarNotificacion(
      mensaje || "Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    res.json({ ok: result.ok, mensaje: result.ok ? "Notificación enviada" : "Error" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/programar', async (req, res) => {
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
    
    setTimeout(async () => {
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
    }, msHasta);
    
    if (url) {
      setTimeout(async () => {
        try { await fetch(url); } catch (e) {}
      }, msHasta);
    }
    
    res.json({ ok: true, id: alertaId, msHasta });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/disparar-ahora', async (req, res) => {
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
  console.log(`\n🚀 Servidor iniciado`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Bark: Ringtone + Body`);
  console.log(`🧪 Prueba: POST /api/alexa/prueba-rapida\n`);
});
