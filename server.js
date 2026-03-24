// ============================================
// SERVIDOR DE PAYTRACK
// Con diagnóstico de ntfy.sh y token en URL
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE NTFY.SH
// ============================================

// TEMA: nombre del canal donde se publican las notificaciones
const NTFY_TOPIC = 'paytrack_deozlink';

// TOKEN: créalo en https://ntfy.sh/app → Account → Access tokens
const NTFY_TOKEN = 'tk_duwqyl6xrt8bh510p5b23xysy7ser';

// MODO: 'header' o 'url' (probar ambos)
// 'header' - envía token en Authorization header
// 'url'    - envía token en la URL (?auth=token)
const NTFY_MODE = process.env.NTFY_MODE || 'url'; // Cambiar a 'header' si no funciona

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE NTFY.SH');
console.log('========================================');
console.log(`📱 Tema: ${NTFY_TOPIC}`);
console.log(`🔑 Token: ${NTFY_TOKEN ? NTFY_TOKEN.substring(0, 15) + '...' : '❌ NO CONFIGURADO'}`);
console.log(`📡 Modo de envío: ${NTFY_MODE === 'url' ? 'URL (?auth=token)' : 'Header (Authorization: Bearer)'}`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR NOTIFICACIÓN
// ============================================

/**
 * Envía una notificación push al teléfono usando ntfy.sh
 * Soporta dos modos: token en header o token en URL
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  const startTime = Date.now();
  
  try {
    // Validar configuración
    if (!NTFY_TOKEN) {
      console.error('❌ ERROR: NTFY_TOKEN no está configurado');
      return { ok: false, error: 'Token no configurado' };
    }
    
    console.log('\n📤 ========== ENVIANDO NOTIFICACIÓN ==========');
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    console.log(`💳 Tarjeta: ${tarjeta || 'No especificada'}`);
    console.log(`📝 Mensaje: ${mensaje}`);
    console.log(`📡 Modo: ${NTFY_MODE === 'url' ? 'URL con token' : 'Header con token'}`);
    
    // Construir el cuerpo del mensaje
    const texto = `${mensaje}

Tarjeta: ${tarjeta || 'No especificada'}
Fecha: ${fecha || 'No especificada'}
Hora: ${hora || 'No especificada'}

PayTrack - Gestión de pagos`;

    console.log(`📦 Tamaño del mensaje: ${texto.length} caracteres`);
    
    // ============================================
    // MODO 1: Token en URL (?auth=token)
    // ============================================
    if (NTFY_MODE === 'url') {
      const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
      console.log(`🌐 URL: ${url.substring(0, 60)}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Title': 'PayTrack - Recordatorio',
          'Priority': 'high',
          'Tags': 'credit_card,money'
        },
        body: texto
      });
      
      const elapsedTime = Date.now() - startTime;
      console.log(`⏱️  Respuesta en ${elapsedTime}ms`);
      console.log(`📥 Status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log(`📥 Respuesta: ${responseText.substring(0, 200)}`);
      
      if (response.ok) {
        console.log(`✅ NOTIFICACIÓN ENVIADA (modo URL)`);
        return { ok: true, mode: 'url' };
      }
      
      console.error(`❌ ERROR ${response.status}`);
      return { ok: false, error: `Error ${response.status}: ${responseText.substring(0, 100)}` };
    }
    
    // ============================================
    // MODO 2: Token en Header Authorization
    // ============================================
    const url = `https://ntfy.sh/${NTFY_TOPIC}`;
    console.log(`🌐 URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NTFY_TOKEN}`,
        'Title': 'PayTrack - Recordatorio',
        'Priority': 'high',
        'Tags': 'credit_card,money'
      },
      body: texto
    });
    
    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️  Respuesta en ${elapsedTime}ms`);
    console.log(`📥 Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📥 Respuesta: ${responseText.substring(0, 200)}`);
    
    if (response.ok) {
      console.log(`✅ NOTIFICACIÓN ENVIADA (modo header)`);
      return { ok: true, mode: 'header' };
    }
    
    console.error(`❌ ERROR ${response.status}`);
    return { ok: false, error: `Error ${response.status}: ${responseText.substring(0, 100)}` };
    
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`❌ ERROR DE RED después de ${elapsedTime}ms: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINT DE DIAGNÓSTICO
// ============================================

/**
 * Prueba directa a ntfy.sh para verificar si el token funciona
 * Visita: /test-ntfy
 */
app.get('/test-ntfy', async (req, res) => {
  console.log('\n🔍 ========== TEST NTFY ==========');
  console.log(`📡 Modo: ${NTFY_MODE === 'url' ? 'URL con token' : 'Header con token'}`);
  
  try {
    let response;
    
    if (NTFY_MODE === 'url') {
      const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Title': 'Test Diagnóstico',
          'Priority': 'low'
        },
        body: 'Mensaje de prueba desde /test-ntfy'
      });
    } else {
      response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NTFY_TOKEN}`,
          'Title': 'Test Diagnóstico',
          'Priority': 'low'
        },
        body: 'Mensaje de prueba desde /test-ntfy'
      });
    }
    
    const result = {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      body: await response.text(),
      mode: NTFY_MODE,
      topic: NTFY_TOPIC,
      token_prefix: NTFY_TOKEN.substring(0, 10) + '...',
      sugerencia: response.status === 429 ? 'El token no se está aplicando. Cambia NTFY_MODE a "url" o "header"' : null
    };
    
    console.log(`📥 Status: ${result.status}`);
    console.log(`📥 Body: ${result.body.substring(0, 200)}`);
    console.log('========================================\n');
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error en test: ${error.message}`);
    res.json({ error: error.message, mode: NTFY_MODE });
  }
});

// ============================================
// ENDPOINT PARA CAMBIAR MODO SIN REDEPLOY
// ============================================

/**
 * Cambia el modo de envío (header o url)
 * Visita: /set-mode?mode=url  o /set-mode?mode=header
 */
let currentMode = NTFY_MODE;

app.get('/set-mode', (req, res) => {
  const { mode } = req.query;
  if (mode === 'url' || mode === 'header') {
    currentMode = mode;
    // Sobrescribir para esta ejecución
    Object.defineProperty(global, 'NTFY_MODE', { value: mode, writable: true });
    res.json({ ok: true, mode: currentMode, mensaje: `Modo cambiado a ${mode}. Prueba /test-ntfy nuevamente.` });
  } else {
    res.json({ ok: false, error: 'Modo inválido. Usa ?mode=url o ?mode=header' });
  }
});

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    ntfy_topic: NTFY_TOPIC,
    ntfy_mode: currentMode,
    token_configurado: !!NTFY_TOKEN,
    diagnosticar: "/test-ntfy",
    cambiar_modo: "/set-mode?mode=url o ?mode=header"
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

// ============================================
// PRUEBA RÁPIDA
// ============================================

app.post('/api/alexa/prueba-rapida', async (req, res) => {
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
    
    res.json({ 
      ok: result.ok, 
      mensaje: result.ok ? "Notificación enviada" : "Error",
      modo_usado: result.mode,
      detalle: result 
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================
// PROGRAMAR ALERTA
// ============================================

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
  console.log(`\n🚀 Servidor PayTrack corriendo`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Tema: ${NTFY_TOPIC}`);
  console.log(`📡 Modo actual: ${currentMode}`);
  console.log(`\n🔍 DIAGNÓSTICO:`);
  console.log(`   Visita: /test-ntfy`);
  console.log(`   Cambiar modo: /set-mode?mode=url  o /set-mode?mode=header`);
  console.log(`\n🧪 Prueba: POST /api/alexa/prueba-rapida\n`);
});
