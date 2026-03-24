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
// Usamos un tema fijo para que los usuarios se suscriban una sola vez
const NTFY_TOPIC = 'paytrack_deozlink';

// TOKEN: créalo en https://ntfy.sh/app → Account → Access tokens
// Este token se envía en la URL para autenticarte y evitar límites por IP
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

/**
 * Envía una notificación push usando ntfy.sh con token en URL
 * @param {string} mensaje - Texto principal
 * @param {string} fecha - Fecha (YYYY-MM-DD)
 * @param {string} hora - Hora (HH:MM)
 * @param {string} tarjeta - Nombre de la tarjeta
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Validar configuración
    if (!NTFY_TOKEN) {
      console.error('❌ ERROR: NTFY_TOKEN no está configurado');
      return { ok: false, error: 'Token no configurado' };
    }

    // Construir el mensaje
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;

    // 🔑 TOKEN EN LA URL (la forma más simple y confiable)
    const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
    
    console.log(`📤 Enviando notificación...`);
    console.log(`   URL: ${url.substring(0, 70)}...`);
    console.log(`   Mensaje: ${mensaje.substring(0, 50)}...`);

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
      const responseText = await response.text();
      console.log(`✅ Notificación enviada correctamente`);
      console.log(`   Respuesta: ${responseText.substring(0, 100)}`);
      return { ok: true };
    }
    
    // Si hay error, leer el mensaje
    const errorText = await response.text();
    console.error(`❌ Error ${response.status}:`, errorText);
    
    // Si es error 429, dar instrucciones
    if (response.status === 429) {
      console.error(`
⚠️  LÍMITE DE MENSAJES ALCANZADO

Posibles soluciones:
1. Espera unos minutos y vuelve a intentar
2. Crea un nuevo token en https://ntfy.sh/app
3. Usa un tema diferente (cambia NTFY_TOPIC)
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

/**
 * Endpoint principal - Estado del servidor
 */
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    ntfy_topic: NTFY_TOPIC,
    ntfy_mode: "token en URL",
    token_configurado: !!NTFY_TOKEN,
    instrucciones: "Suscríbete en la app ntfy con el tema: " + NTFY_TOPIC
  });
});

/**
 * Política de privacidad
 */
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head><meta charset="UTF-8"><title>Política de Privacidad - PayTrack</title></head>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>Última actualización: 24 de marzo de 2026</p>
        
        <h2>1. Información que recopilamos</h2>
        <p>PayTrack utiliza ntfy.sh para enviar notificaciones push a tu teléfono sobre recordatorios de pago.</p>
        <p>No almacenamos información personal. Solo procesamos los datos necesarios para enviar la notificación.</p>
        
        <h2>2. Cómo usamos tu información</h2>
        <p>Las notificaciones contienen información sobre tus pagos pendientes (tarjeta, fecha, hora).</p>
        <p>Esta información no se almacena ni se comparte con terceros.</p>
        
        <h2>3. Seguridad</h2>
        <p>Las comunicaciones con ntfy.sh son encriptadas mediante HTTPS.</p>
        
        <h2>4. Contacto</h2>
        <p>soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

/**
 * Endpoint de diagnóstico - prueba directa a ntfy.sh
 * Visita /test-ntfy para verificar que el token funciona
 */
app.get('/test-ntfy', async (req, res) => {
  console.log('\n🔍 ========== DIAGNÓSTICO NTFY ==========');
  
  try {
    const url = `https://ntfy.sh/${NTFY_TOPIC}?auth=${NTFY_TOKEN}`;
    console.log(`📡 Probando token en URL: ${url.substring(0, 70)}...`);
    
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
      statusText: response.statusText,
      body: await response.text(),
      topic: NTFY_TOPIC,
      token_prefix: NTFY_TOKEN ? NTFY_TOKEN.substring(0, 10) + '...' : null,
      modo: 'token en URL'
    };
    
    console.log(`📥 Status: ${result.status}`);
    console.log(`📥 Body: ${result.body.substring(0, 200)}`);
    console.log('========================================\n');
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error en test: ${error.message}`);
    res.json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS DE PRUEBA Y PROGRAMACIÓN
// ============================================

/**
 * PRUEBA RÁPIDA - Envía una notificación inmediata
 */
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  console.log('\n🧪 ========== PRUEBA RÁPIDA ==========');
  
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    console.log(`📝 Mensaje: ${mensaje || 'Prueba de PayTrack'}`);
    
    const result = await enviarNotificacion(
      mensaje || "🔔 Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    console.log(`📊 Resultado: ${result.ok ? 'ÉXITO' : 'FALLO'}`);
    console.log('========================================\n');
    
    res.json({ 
      ok: result.ok, 
      mensaje: result.ok ? "Notificación enviada" : "Error",
      detalle: result 
    });
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PROGRAMAR ALERTA - Crea un recordatorio programado
 */
app.post('/api/voice/programar', async (req, res) => {
  console.log('\n📅 ========== PROGRAMAR ALERTA ==========');
  
  try {
    const { url, fecha, hora, tarjeta, mensaje, id } = req.body;
    
    console.log(`📨 Body recibido:`, { fecha, hora, tarjeta, mensaje });
    
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
    
    console.log(`⏱️  Tiempo hasta ejecución: ${Math.round(msHasta/1000)} segundos`);
    console.log(`🆔 ID: ${alertaId}`);
    
    // Programar la notificación
    setTimeout(async () => {
      console.log(`\n🔔 ========== EJECUTANDO ALERTA ==========`);
      console.log(`🆔 ID: ${alertaId}`);
      console.log(`📅 Fecha: ${fecha} ${hora}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
      console.log(`========================================\n`);
    }, msHasta);
    
    // Voice Monkey como respaldo
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
    console.error(`❌ Error en /programar:`, error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DISPARAR AHORA - Alerta inmediata
 */
app.post('/api/voice/disparar-ahora', async (req, res) => {
  console.log('\n⚡ ========== DISPARAR AHORA ==========');
  
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    
    const result = await enviarNotificacion(
      mensaje || "Alerta inmediata de PayTrack",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    if (url) {
      await fetch(url.trim()).catch(e => console.error('Voice Monkey falló:', e.message));
    }
    
    console.log(`📊 Resultado: ${result.ok ? 'ÉXITO' : 'FALLO'}`);
    console.log('========================================\n');
    
    res.json({ ok: result.ok, mensaje: result.ok ? "Alerta enviada" : "Error" });
  } catch (error) {
    console.error(`❌ Error:`, error);
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
  console.log(`🔑 Token ntfy: ${NTFY_TOKEN ? '✅ CONFIGURADO' : '❌ FALTANTE'}`);
  console.log(`📡 Modo: Token en URL (?auth=token)`);
  console.log(`\n🔍 DIAGNÓSTICO:`);
  console.log(`   Visita: /test-ntfy`);
  console.log(`\n📱 PARA RECIBIR NOTIFICACIONES:`);
  console.log(`   1. Descarga la app ntfy (iOS/Android)`);
  console.log(`   2. Suscríbete al tema: ${NTFY_TOPY}`);
  console.log(`\n🧪 PRUEBA RÁPIDA:`);
  console.log(`   POST /api/alexa/prueba-rapida`);
  console.log(`   Body: {"mensaje": "Hola"}`);
  console.log('========================================\n');
});
