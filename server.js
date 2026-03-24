// ============================================
// SERVIDOR DE PAYTRACK CON LOGS DE DEPURACIÓN
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

console.log('\n========================================');
console.log('🔧 CONFIGURACIÓN DE NTFY.SH');
console.log('========================================');
console.log(`📱 Tema: ${NTFY_TOPIC}`);
console.log(`🔑 Token: ${NTFY_TOKEN ? NTFY_TOKEN.substring(0, 15) + '...' : '❌ NO CONFIGURADO'}`);
console.log(`📏 Longitud token: ${NTFY_TOKEN ? NTFY_TOKEN.length : 0} caracteres`);
console.log('========================================\n');

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR NOTIFICACIÓN CON LOGS
// ============================================

/**
 * Envía una notificación push al teléfono usando ntfy.sh
 * Con logs detallados para depuración
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  const startTime = Date.now();
  
  try {
    // Validar configuración
    if (!NTFY_TOKEN) {
      console.error('❌ ERROR CRÍTICO: NTFY_TOKEN no está configurado');
      return { ok: false, error: 'Token no configurado' };
    }
    
    if (!NTFY_TOPIC) {
      console.error('❌ ERROR CRÍTICO: NTFY_TOPIC no está configurado');
      return { ok: false, error: 'Tema no configurado' };
    }
    
    console.log('\n📤 ========== ENVIANDO NOTIFICACIÓN ==========');
    console.log(`📅 Fecha/Hora: ${fecha} ${hora}`);
    console.log(`💳 Tarjeta: ${tarjeta || 'No especificada'}`);
    console.log(`📝 Mensaje: ${mensaje}`);
    console.log(`🔑 Token usado: ${NTFY_TOKEN.substring(0, 10)}...`);
    console.log(`📱 Tema: ${NTFY_TOPIC}`);
    
    // Construir el cuerpo del mensaje
    const texto = `${mensaje}

Tarjeta: ${tarjeta || 'No especificada'}
Fecha: ${fecha || 'No especificada'}
Hora: ${hora || 'No especificada'}

PayTrack - Gestión de pagos`;

    console.log(`📦 Tamaño del mensaje: ${texto.length} caracteres`);
    
    // Construir la URL
    const url = `https://ntfy.sh/${NTFY_TOPIC}`;
    console.log(`🌐 URL destino: ${url}`);
    
    // Preparar headers
    const headers = {
      'Authorization': `Bearer ${NTFY_TOKEN}`,
      'Title': 'PayTrack - Recordatorio',
      'Priority': 'high',
      'Tags': 'credit_card,money'
    };
    
    console.log(`📋 Headers enviados:`);
    console.log(`   Authorization: Bearer ${NTFY_TOKEN.substring(0, 15)}...`);
    console.log(`   Title: ${headers.Title}`);
    console.log(`   Priority: ${headers.Priority}`);
    console.log(`   Tags: ${headers.Tags}`);
    
    // Enviar la petición
    console.log(`⏳ Enviando petición...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: texto
    });
    
    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️  Respuesta recibida en ${elapsedTime}ms`);
    console.log(`📥 Status code: ${response.status} ${response.statusText}`);
    
    // Leer la respuesta
    const responseText = await response.text();
    console.log(`📥 Respuesta cuerpo: ${responseText.substring(0, 300)}`);
    
    if (response.ok) {
      console.log(`✅ NOTIFICACIÓN ENVIADA CON ÉXITO!`);
      console.log('========================================\n');
      return { ok: true, response: responseText };
    }
    
    // Error específico 429
    if (response.status === 429) {
      console.error(`❌ ERROR 429: Límite de mensajes alcanzado`);
      console.error(`   Esto puede ser porque:`);
      console.error(`   1. El token no se está aplicando correctamente`);
      console.error(`   2. La IP de Render está bloqueada`);
      console.error(`   3. El token expiró o es inválido`);
      console.error(`📊 Solución: Crear un nuevo token en https://ntfy.sh/app`);
    }
    
    console.error(`❌ ERROR: ${response.status} - ${responseText.substring(0, 200)}`);
    console.log('========================================\n');
    return { ok: false, error: `Error ${response.status}: ${responseText.substring(0, 100)}` };
    
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`❌ ERROR DE RED después de ${elapsedTime}ms:`);
    console.error(`   Tipo: ${error.name}`);
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Stack: ${error.stack?.substring(0, 200)}`);
    console.log('========================================\n');
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

/**
 * Endpoint principal - Verificar que el servidor funciona
 */
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    ntfy_topic: NTFY_TOPIC,
    token_configurado: !!NTFY_TOKEN,
    token_longitud: NTFY_TOKEN ? NTFY_TOKEN.length : 0,
    instrucciones: "Suscríbete en la app ntfy con este tema para recibir notificaciones"
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
        <p>PayTrack utiliza ntfy.sh para enviar notificaciones a tu teléfono sobre recordatorios de pago.</p>
        <p>No almacenamos información personal.</p>
        
        <h2>2. Cómo usamos tu información</h2>
        <p>Las notificaciones contienen información sobre tus pagos pendientes (tarjeta, fecha, hora).</p>
        
        <h2>3. Seguridad</h2>
        <p>Las comunicaciones con ntfy.sh son encriptadas mediante HTTPS.</p>
        
        <h2>4. Contacto</h2>
        <p>soporte@paytrack.com</p>
      </body>
    </html>
  `);
});

/**
 * Endpoint para diagnosticar el tema
 */
app.get('/topic', (req, res) => {
  res.json({
    topic: NTFY_TOPIC,
    subscribe_url: `https://ntfy.sh/${NTFY_TOPIC}`,
    token_configurado: !!NTFY_TOKEN,
    app: "Descarga la app ntfy en tu teléfono y suscríbete a este tema",
    test_url: `https://ntfy.sh/${NTFY_TOPIC}`,
    test_command: `curl -H "Authorization: Bearer ${NTFY_TOKEN}" -H "Title: Test" -d "Mensaje de prueba" https://ntfy.sh/${NTFY_TOPIC}`
  });
});

// ============================================
// ENDPOINTS DE PRUEBA Y PROGRAMACIÓN
// ============================================

/**
 * PRUEBA RÁPIDA - Envía una notificación inmediata con logs
 */
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  const requestId = Date.now();
  console.log(`\n🔔 ========== PRUEBA RÁPIDA #${requestId} ==========`);
  console.log(`📨 Body recibido:`, req.body);
  
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Fecha/hora local: ${fecha} ${hora}`);
    
    const result = await enviarNotificacion(
      mensaje || "🔔 Prueba de PayTrack",
      fecha,
      hora,
      "Prueba"
    );
    
    console.log(`📊 Resultado final: ${result.ok ? 'ÉXITO' : 'FALLO'}`);
    console.log(`========================================\n`);
    
    res.json({ 
      ok: result.ok, 
      mensaje: result.ok ? "Notificación enviada" : "Error",
      detalle: result,
      request_id: requestId
    });
  } catch (error) {
    console.error(`❌ Error en prueba rápida:`, error);
    res.status(500).json({ ok: false, error: error.message, request_id: requestId });
  }
});

/**
 * PROGRAMAR ALERTA
 */
app.post('/api/voice/programar', async (req, res) => {
  const requestId = Date.now();
  console.log(`\n📅 ========== PROGRAMAR ALERTA #${requestId} ==========`);
  console.log(`📨 Body recibido:`, req.body);
  
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
    
    console.log(`📅 Alerta programada para: ${fecha} ${hora}`);
    console.log(`⏱️  Tiempo hasta ejecución: ${Math.round(msHasta/1000)} segundos`);
    
    setTimeout(async () => {
      console.log(`\n🔔 ========== EJECUTANDO ALERTA PROGRAMADA ==========`);
      console.log(`🆔 ID: ${alertaId}`);
      console.log(`📅 Fecha: ${fecha} ${hora}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
      console.log(`========================================\n`);
    }, msHasta);
    
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
 * DISPARAR AHORA
 */
app.post('/api/voice/disparar-ahora', async (req, res) => {
  const requestId = Date.now();
  console.log(`\n⚡ ========== DISPARAR AHORA #${requestId} ==========`);
  
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
    
    if (url) {
      await fetch(url.trim()).catch(e => console.error('Voice Monkey falló:', e.message));
    }
    
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
  console.log(`🔌 Puerto: ${PORT}`);
  console.log(`📱 Tema ntfy: ${NTFY_TOPIC}`);
  console.log(`🔑 Token ntfy: ${NTFY_TOKEN ? '✅ CONFIGURADO' : '❌ FALTANTE'}`);
  console.log(`\n📋 Endpoints disponibles:`);
  console.log(`   GET  /                      - Estado del servidor`);
  console.log(`   GET  /privacy               - Política de privacidad`);
  console.log(`   GET  /topic                 - Info del tema (incluye comando curl)`);
  console.log(`   POST /api/alexa/prueba-rapida - Probar notificación`);
  console.log(`   POST /api/voice/programar   - Programar alerta`);
  console.log(`   POST /api/voice/disparar-ahora - Alerta inmediata`);
  console.log(`\n📱 Para recibir notificaciones:`);
  console.log(`   1. Descarga la app ntfy (iOS/Android)`);
  console.log(`   2. Suscríbete al tema: ${NTFY_TOPIC}`);
  console.log(`\n🧪 Prueba rápida desde terminal:`);
  console.log(`   curl -X POST https://voice-api-dblt-if6d.onrender.com/api/alexa/prueba-rapida \\`);
  console.log(`        -H "Content-Type: application/json" \\`);
  console.log(`        -d '{"mensaje":"Prueba desde terminal"}'`);
  console.log('========================================\n');
});
