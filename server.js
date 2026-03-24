// ============================================
// SERVIDOR DE PAYTRACK
// Notificaciones con ntfy.sh usando token en URL
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE NTFY.SH
// ============================================

// TEMA: nombre del canal (cámbialo si quieres)
const NTFY_TOPIC = 'paytrack_deozlink';

// TOKEN: créalo en https://ntfy.sh/app → Account → Access tokens
const NTFY_TOKEN = 'tk_duwqyl6xrt8bh510p5b23xysy7ser';

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE NTFY.SH');
console.log('========================================');
console.log(`📱 Tema: ${NTFY_TOPIC}`);
console.log(`🔑 Token: ${NTFY_TOKEN ? '✅ configurado' : '❌ faltante'}`);
console.log(`📡 Modo: Token en URL (?auth=token)`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIONES
// ============================================

async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    if (!NTFY_TOKEN) {
      console.error('❌ ERROR: NTFY_TOKEN no está configurado');
      return { ok: false, error: 'Token no configurado' };
    }

    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;

    // 🔑 TOKEN EN LA URL
    const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
    
    console.log(`📤 Enviando notificación...`);
    console.log(`   URL: ${url.substring(0, 70)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': 'PayTrack - Recordatorio',
        'Priority': 'high',
        'Tags': 'credit_card,money'
      },
      body: texto
    });

    console.log(`📥 Respuesta ntfy.sh: status ${response.status}`);

    if (response.ok) {
      console.log(`✅ Notificación enviada correctamente`);
      return { ok: true };
    }
    
    const errorText = await response.text();
    console.error(`❌ Error ${response.status}:`, errorText);
    
    if (response.status === 429) {
      console.error(`
⚠️  LÍMITE DE MENSAJES ALCANZADO

Soluciones:
1. Espera unos minutos
2. Crea un nuevo token en https://ntfy.sh/app
3. Cambia NTFY_TOPIC a un tema nuevo
`);
    }
    
    return { ok: false, error: `Error ${response.status}` };
    
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    ntfy_topic: NTFY_TOPIC,
    token_configurado: !!NTFY_TOKEN,
    instrucciones: "Suscríbete en la app ntfy con el tema: " + NTFY_TOPIC
  });
});

app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head><meta charset="UTF-8"><title>Política de Privacidad - PayTrack</title></head>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>PayTrack utiliza ntfy.sh para enviar notificaciones push a tu teléfono.</p>
        <p>No almacenamos información personal.</p>
        <p>Contacto: soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

// ============================================
// ENDPOINT DE DIAGNÓSTICO
// ============================================

app.get('/test-ntfy', async (req, res) => {
  console.log('\n🔍 ========== DIAGNÓSTICO NTFY ==========');
  
  try {
    const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
    console.log(`📡 Probando URL: ${url.substring(0, 70)}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': 'Diagnóstico PayTrack',
        'Priority': 'low'
      },
      body: 'Mensaje de prueba desde /test-ntfy'
    });
    
    const result = {
      status: response.status,
      ok: response.ok,
      body: await response.text(),
      topic: NTFY_TOPIC,
      modo: 'token en URL'
    };
    
    console.log(`📥 Status: ${result.status}`);
    console.log('========================================\n');
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS DE PRUEBA Y PROGRAMACIÓN
// ============================================

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
    
    res.json({ 
      ok: result.ok, 
      mensaje: result.ok ? "Notificación enviada" : "Error",
      detalle: result 
    });
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
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta
    });
    
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

// ============================================
// INICIO DEL SERVIDOR
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 SERVIDOR PAYTRACK INICIADO');
  console.log('========================================');
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Tema ntfy: ${NTFY_TOPIC}`);
  console.log(`🔑 Token: ${NTFY_TOKEN ? '✅ CONFIGURADO' : '❌ FALTANTE'}`);
  console.log(`\n🔍 DIAGNÓSTICO: /test-ntfy`);
  console.log(`🧪 PRUEBA: POST /api/alexa/prueba-rapida`);
  console.log('========================================\n');
});
