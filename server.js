const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE NTFY CON TOKEN
// ============================================

// TEMA: el nombre del canal donde se publicarán las notificaciones
// CAMBIALO por uno único, por ejemplo: paytrack_[tu_nombre]
const NTFY_TOPIC = 'paytrack_daniel'; // ← CAMBIA ESTO

// TOKEN: créalo en https://ntfy.sh/app → Account → Access tokens
// Es la "llave" que autentica tu servidor y evita bloqueos por IP
const NTFY_TOKEN = 'tk_xxxxxxxxxxxxxxxxxxxxxxxx'; // ← PON AQUÍ TU TOKEN

console.log(`📱 ntfy configurado:`);
console.log(`   Tema: ${NTFY_TOPIC}`);
console.log(`   Token: ${NTFY_TOKEN.substring(0, 10)}... (oculto)`);
console.log(`🔔 Suscríbete en la app ntfy con el tema: ${NTFY_TOPIC}`);

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIONES
// ============================================

/**
 * Envía una notificación push al teléfono usando ntfy.sh
 * @param {string} mensaje - Texto principal de la notificación
 * @param {string} fecha - Fecha del recordatorio (YYYY-MM-DD)
 * @param {string} hora - Hora del recordatorio (HH:MM)
 * @param {string} tarjeta - Nombre de la tarjeta (opcional)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function enviarNotificacion(mensaje, fecha, hora, tarjeta = '') {
  try {
    // Construir el mensaje en texto plano (sin emojis en el body)
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;

    // Enviar a ntfy.sh con autenticación por token
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NTFY_TOKEN}`,    // ← Autenticación con token
        'Title': 'PayTrack - Recordatorio',         // Título de la notificación
        'Priority': 'high',                         // Prioridad alta (3)
        'Tags': 'credit_card,money'                 // Etiquetas visuales
      },
      body: texto
    });

    if (response.ok) {
      console.log('✅ Notificación enviada por ntfy.sh');
      return { ok: true };
    }
    
    // Si hubo error, leer el mensaje de respuesta
    const errorText = await response.text();
    console.error(`❌ ntfy.sh respondió con status ${response.status}:`, errorText);
    throw new Error(`Error ${response.status}: ${errorText.substring(0, 100)}`);
    
  } catch (error) {
    console.error('❌ Error al enviar notificación:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

// Verificar estado del servidor
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    mensaje: "API de PayTrack funcionando",
    ntfy_topic: NTFY_TOPIC,
    instrucciones: "Suscríbete en la app ntfy con este tema para recibir notificaciones"
  });
});

// Política de privacidad (requerida para tiendas de apps)
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

// Obtener información del tema (útil para debugging)
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
    
    console.log(`📅 Enviando prueba: ${fecha} ${hora}`);
    const result = await enviarNotificacion(
      mensaje || "Prueba de PayTrack",
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
 */
app.post('/api/voice/programar', async (req, res) => {
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
    
    // Programar la notificación de ntfy.sh
    setTimeout(async () => {
      console.log(`🔔 Ejecutando alerta programada: ${alertaId} para ${fecha} ${hora}`);
      await enviarNotificacion(textoMensaje, fecha, hora, tarjeta);
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
  try {
    const { url, mensaje, tarjeta } = req.body;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
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
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 TEMA NTFY: ${NTFY_TOPIC}`);
  console.log(`🧪 Prueba rápida: POST /api/alexa/prueba-rapida`);
  console.log(`📅 Programar alerta: POST /api/voice/programar`);
  console.log(`⚡ Disparar ahora: POST /api/voice/disparar-ahora\n`);
});
