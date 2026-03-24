const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE NTFY (GRATUITO)
// ============================================
// Tema único para tus notificaciones
const NTFY_TOPIC = 'paytrack_' + Math.random().toString(36).substring(2, 8);
console.log(`📱 Tema ntfy: ${NTFY_TOPIC}`);
console.log(`🔔 Suscríbete en la app ntfy con: ${NTFY_TOPIC}`);

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIONES
// ============================================

async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Construir el mensaje sin emojis problemáticos
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;

    // Enviar a ntfy.sh
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': 'PayTrack - Recordatorio',
        'Priority': 'high',
        'Tags': 'credit_card,money'
      },
      body: texto
    });

    if (response.ok) {
      console.log('✅ Notificación enviada por ntfy.sh');
      return { ok: true };
    }
    
    throw new Error(`Error: ${response.status}`);
    
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
    ntfy_topic: NTFY_TOPIC
  });
});

app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>PayTrack utiliza ntfy.sh para enviar notificaciones a tu teléfono.</p>
        <p>Contacto: soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

app.get('/topic', (req, res) => {
  res.json({
    topic: NTFY_TOPIC,
    subscribe_url: `https://ntfy.sh/${NTFY_TOPIC}`
  });
});

app.post('/api/alexa/prueba-rapida', async (req, res) => {
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Enviando prueba: ${fecha} ${hora}`);
    const result = await enviarNotificacion(
      mensaje || "Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    res.json({ ok: result.ok, mensaje: result.ok ? "Notificación enviada" : "Error", detalle: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/programar', async (req, res) => {
  try {
    const { url, fecha, hora, tarjeta, mensaje } = req.body;
    
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
    
    // Programar la notificación
    setTimeout(async () => {
      console.log(`🔔 Ejecutando alerta: ${alertaId}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
    }, msHasta);
    
    // Voice Monkey como respaldo
    if (url) {
      setTimeout(async () => {
        try { await fetch(url); console.log(`✅ Voice Monkey ejecutado`); } catch (e) {}
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
    console.error("Error:", error);
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
      mensaje || "Alerta inmediata de PayTrack",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    if (url) await fetch(url.trim()).catch(() => {});
    
    res.json({ ok: result.ok, mensaje: "Alerta enviada" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 TEMA NTFY: ${NTFY_TOPIC}`);
  console.log(`🧪 Prueba: POST /api/alexa/prueba-rapida`);
});
