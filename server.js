const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE ALEXA - SCOPE CORREGIDO
// ============================================
const ALEXA_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt-if6d.onrender.com/auth/alexa/callback',
  scope: 'alexa:alerts:reminders:skill:readwrite profile'  // ← SCOPE COMPLETO
};

// Almacenamiento de tokens
let alexaTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Almacenamiento de alertas
const alertas = new Map();
const alertaTimeouts = new Map();

// ============================================
// FUNCIONES DE ALEXA
// ============================================

async function getAlexaAccessToken() {
  // Si hay token válido, usarlo
  if (alexaTokens.accessToken && alexaTokens.expiresAt > Date.now()) {
    return alexaTokens.accessToken;
  }

  // Si hay refresh token, renovar
  if (alexaTokens.refreshToken) {
    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: alexaTokens.refreshToken,
          client_id: ALEXA_CONFIG.clientId,
          client_secret: ALEXA_CONFIG.clientSecret
        }).toString()
      });
      
      const data = await response.json();
      alexaTokens.accessToken = data.access_token;
      alexaTokens.refreshToken = data.refresh_token;
      alexaTokens.expiresAt = Date.now() + (data.expires_in * 1000);
      return alexaTokens.accessToken;
    } catch (error) {
      console.error('Error refrescando token:', error.message);
    }
  }
  
  throw new Error('No hay token. Visita /auth/alexa');
}

async function crearRecordatorioAlexa(mensaje, fecha, hora) {
  try {
    const accessToken = await getAlexaAccessToken();
    
    // Formato de fecha/hora para CDMX (UTC-6)
    const scheduledTime = `${fecha}T${hora}:00.000-06:00`;
    
    const reminderBody = {
      trigger: {
        type: "SCHEDULED_ABSOLUTE",
        scheduledTime: scheduledTime,
        timeZoneId: "America/Mexico_City"
      },
      alertInfo: {
        spokenInfo: {
          content: [{
            locale: "es-MX",
            text: mensaje,
            ssml: `<speak>${mensaje}</speak>`
          }]
        }
      },
      pushNotification: { status: "ENABLED" }
    };
    
    const response = await fetch('https://api.amazonalexa.com/v2/alerts/reminders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reminderBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error Alexa API:', data);
      throw new Error(data.message || 'Error al crear recordatorio');
    }
    
    console.log('✅ Recordatorio creado:', data);
    return { ok: true, reminderId: data.id };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS
// ============================================

// Endpoint principal
app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

// Iniciar autenticación con Amazon
app.get('/auth/alexa', (req, res) => {
  const authUrl = `https://www.amazon.com/ap/oa?client_id=${ALEXA_CONFIG.clientId}&scope=${encodeURIComponent(ALEXA_CONFIG.scope)}&response_type=code&redirect_uri=${encodeURIComponent(ALEXA_CONFIG.redirectUri)}`;
  console.log('🔐 Redirigiendo a:', authUrl);
  res.redirect(authUrl);
});

// Callback después de autenticación
app.get('/auth/alexa/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send('Error: No se recibió código de autorización');
  }
  
  try {
    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: ALEXA_CONFIG.clientId,
        client_secret: ALEXA_CONFIG.clientSecret,
        redirect_uri: ALEXA_CONFIG.redirectUri
      }).toString()
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    alexaTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
    
    console.log('✅ Token guardado, expira en:', data.expires_in, 'segundos');
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: green;">✅ Autenticación exitosa</h1>
          <p>PayTrack ahora puede crear recordatorios en Alexa.</p>
          <p>Los recordatorios llegarán a tu teléfono a través de la app de Alexa.</p>
          <p>Ya puedes cerrar esta ventana y volver a tu app.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error en callback:', error.message);
    res.send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Verificar estado de autenticación
app.get('/auth/status', (req, res) => {
  const isAuthed = alexaTokens.accessToken && alexaTokens.expiresAt > Date.now();
  res.json({ 
    autenticado: isAuthed,
    expira: alexaTokens.expiresAt ? new Date(alexaTokens.expiresAt).toISOString() : null
  });
});

// PRUEBA RÁPIDA - crea un recordatorio en 10 segundos
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    ahora.setSeconds(ahora.getSeconds() + 10);
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Programando prueba: ${fecha} ${hora}`);
    const result = await crearRecordatorioAlexa(mensaje || "Prueba desde PayTrack", fecha, hora);
    res.json({ ok: result.ok, mensaje: result.ok ? "Recordatorio en 10 segundos" : "Error", detalle: result });
  } catch (error) {
    console.error('Error en prueba rápida:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Programar alerta (Voice Monkey + Alexa)
app.post('/api/voice/programar', async (req, res) => {
  try {
    const { url, fecha, hora, tarjeta, id } = req.body;
    
    if (!url || !fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan datos: url, fecha, hora" });
    }
    
    const fechaHoraProgramada = new Date(`${fecha}T${hora}:00-06:00`);
    const ahora = new Date();
    
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({ ok: false, error: "Fecha/hora ya pasó" });
    }
    
    // Crear recordatorio en Alexa
    const mensajeAlexa = `Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`;
    const alexaResult = await crearRecordatorioAlexa(mensajeAlexa, fecha, hora);
    
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    // Programar Voice Monkey como respaldo
    const timeoutId = setTimeout(async () => {
      try {
        await fetch(url);
        console.log(`✅ Voice Monkey ejecutado para ${alertaId}`);
      } catch (e) {
        console.error(`❌ Error Voice Monkey: ${e.message}`);
      }
      alertas.delete(alertaId);
    }, msHasta);
    
    alertaTimeouts.set(alertaId, timeoutId);
    alertas.set(alertaId, { id: alertaId, url, fecha, hora, tarjeta });
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta,
      alexa: alexaResult.ok ? "recordatorio_creado" : "fallo_recordatorio"
    });
    
  } catch (error) {
    console.error("Error en /programar:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Disparar alerta inmediata (prueba)
app.post('/api/voice/disparar-ahora', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: "URL requerida" });
    
    await fetch(url.trim());
    console.log('✅ Alerta disparada inmediatamente');
    res.json({ ok: true, mensaje: "Alerta disparada" });
  } catch (error) {
    console.error('Error en disparar-ahora:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`🔐 Autenticación: /auth/alexa`);
  console.log(`📊 Estado: /auth/status`);
  console.log(`🧪 Prueba rápida: POST /api/alexa/prueba-rapida`);
});
