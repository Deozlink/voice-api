// ============================================
// SERVIDOR DE PAYTRACK
// Notificaciones: ntfy.sh (gratis) + Voice Monkey (Alexa)
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
// CAMBIALO por uno único para tus usuarios
const NTFY_TOPIC = 'paytrack_deozlink';

// TOKEN: créalo en https://ntfy.sh/app → Account → Access tokens
// Este token autentica a tu servidor y evita límites por IP
const NTFY_TOKEN = 'tk_duwqyl6xrt8bh510p5b23xysy7ser';

// Verificar que el token está configurado
if (!NTFY_TOKEN) {
  console.error('❌ ERROR: NTFY_TOKEN no está configurado');
  console.log('🔧 Crea un token en https://ntfy.sh/app');
}

console.log(`📱 ntfy.sh configurado:`);
console.log(`   Tema: ${NTFY_TOPIC}`);
console.log(`   Token: ${NTFY_TOKEN ? '✅ presente' : '❌ faltante'}`);

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR NOTIFICACIÓN
// ============================================

/**
 * Envía una notificación push al teléfono usando ntfy.sh
 * @param {string} mensaje - Texto principal (ej: "Recordatorio de pago")
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {string} hora - Hora en formato HH:MM
 * @param {string} tarjeta - Nombre de la tarjeta (opcional)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Construir el cuerpo del mensaje (texto plano)
    const texto = `${mensaje}

Tarjeta: ${tarjeta || 'No especificada'}
Fecha: ${fecha || 'No especificada'}
Hora: ${hora || 'No especificada'}

PayTrack - Gestión de pagos`;

    console.log(`📤 Enviando notificación a ntfy.sh...`);

    // Enviar a ntfy.sh con autenticación por token
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        // IMPORTANTE: estos van en HEADERS, NO en el body
        'Authorization': `Bearer ${NTFY_TOKEN}`,   // Autenticación
        'Title': 'PayTrack - Recordatorio',         // Título de la notificación
        'Priority': 'high',                         // Prioridad (low, default, high, urgent)
        'Tags': 'credit_card,money'                 // Emojis/tags visuales
      },
      body: texto                                    // El texto va en el body
    });

    console.log(`📥 Respuesta ntfy.sh: status ${response.status}`);

    if (response.ok) {
      console.log('✅ Notificación enviada correctamente');
      return { ok: true };
    }
    
    // Si hubo error, leer el mensaje
    const errorText = await response.text();
    console.error(`❌ Error ntfy.sh (${response.status}):`, errorText);
    return { ok: false, error: `Error ${response.status}: ${errorText.substring(0, 100)}` };
    
  } catch (error) {
    console.error('❌ Error de red:', error.message);
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
    instrucciones: "Suscríbete en la app ntfy con este tema para recibir notificaciones"
  });
});

/**
 * Política de privacidad (requerida para tiendas de apps)
 */
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1>Política de Privacidad - PayTrack</h1>
        <p>Última actualización: 24 de marzo de 2026</p>
        
        <h2>1. Información que recopilamos</h2>
        <p>PayTrack utiliza ntfy.sh para enviar notificaciones a tu teléfono sobre recordatorios de pago.</p>
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
 * Obtener información del tema (útil para debugging)
 */
app.get('/topic', (req, res) => {
  res.json({
    topic: NTFY_TOPIC,
    subscribe_url: `https://ntfy.sh/${NTFY_TOPIC}`,
    app: "Descarga la app ntfy en tu teléfono y suscríbete a este tema"
  });
});

// ============================================
// ENDPOINTS DE PRUEBA Y PROGRAMACIÓN
// ============================================

/**
 * PRUEBA RÁPIDA - Envía una notificación inmediata
 * Útil para verificar que todo funciona
 */
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Prueba rápida: ${fecha} ${hora}`);
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
    console.error('Error en prueba rápida:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PROGRAMAR ALERTA - Crea un recordatorio programado
 * Se ejecuta en la fecha y hora especificadas
 * 
 * Body esperado:
 * {
 *   "url": "https://...",           // URL de Voice Monkey (opcional)
 *   "fecha": "2026-03-25",          // Fecha en YYYY-MM-DD
 *   "hora": "09:00",                // Hora en HH:MM
 *   "tarjeta": "NU",                // Nombre de la tarjeta
 *   "mensaje": "Texto personalizado" // Mensaje opcional
 * }
 */
app.post('/api/voice/programar', async (req, res) => {
  try {
    const { url, fecha, hora, tarjeta, mensaje, id } = req.body;
    
    // Validar datos requeridos
    if (!fecha || !hora) {
      return res.status(400).json({ 
        ok: false, 
        error: "Faltan datos: fecha y hora son requeridos" 
      });
    }
    
    // Verificar que la fecha/hora sea futura
    const fechaHoraProgramada = new Date(`${fecha}T${hora}:00-06:00`);
    const ahora = new Date();
    
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({ 
        ok: false, 
        error: "Fecha/hora ya pasó. Elige una fecha futura." 
      });
    }
    
    // Preparar mensaje
    const textoMensaje = mensaje || `Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`;
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    console.log(`📅 Programando alerta ${alertaId} para ${fecha} ${hora} (en ${Math.round(msHasta/1000)} segundos)`);
    
    // ============================================
    // PROGRAMAR NOTIFICACIÓN DE NTFY.SH
    // ============================================
    setTimeout(async () => {
      console.log(`🔔 Ejecutando alerta programada: ${alertaId}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
    }, msHasta);
    
    // ============================================
    // PROGRAMAR VOICE MONKEY (ALEXA) COMO RESPALDO
    // ============================================
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
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`⚡ Disparando alerta inmediata: ${fecha} ${hora}`);
    
    // Enviar notificación inmediata
    const result = await enviarNotificacion(
      mensaje || "Alerta inmediata de PayTrack",
      fecha,
      hora,
      tarjeta || "Alerta"
    );
    
    // Voice Monkey si se proporcionó URL
    if (url) {
      await fetch(url.trim()).catch(() => console.error('Voice Monkey falló'));
    }
    
    res.json({ ok: result.ok, mensaje: "Alerta enviada" });
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
  console.log(`\n🚀 Servidor PayTrack corriendo en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Tema ntfy.sh: ${NTFY_TOPIC}`);
  console.log(`\n🔔 Endpoints disponibles:`);
  console.log(`   GET  /                      - Estado del servidor`);
  console.log(`   GET  /privacy               - Política de privacidad`);
  console.log(`   GET  /topic                 - Información del tema`);
  console.log(`   POST /api/alexa/prueba-rapida - Probar notificación inmediata`);
  console.log(`   POST /api/voice/programar   - Programar alerta`);
  console.log(`   POST /api/voice/disparar-ahora - Disparar alerta inmediata`);
  console.log(`\n📱 Para recibir notificaciones:`);
  console.log(`   1. Descarga la app ntfy (iOS/Android)`);
  console.log(`   2. Suscríbete al tema: ${NTFY_TOPIC}`);
  console.log(`\n✅ Servidor listo!\n`);
});
