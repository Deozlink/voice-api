const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE ALEXA
// ============================================
const ALEXA_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt.onrender.com/auth/alexa/callback',
  scope: 'alexa:alerts:reminders:skill:readwrite alexa::ask:skills:readwrite'
};

let alexaTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

const alertas = new Map();
const alertaTimeouts = new Map();

// ============================================
// FUNCIONES DE ALEXA
// ============================================
async function getAlexaAccessToken() {
  if (alexaTokens.accessToken && alexaTokens.expiresAt > Date.now()) {
    return alexaTokens.accessToken;
  }

  if (alexaTokens.refreshToken) {
    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: alexaTokens.refreshToken,
          client_id: ALEXA_CONFIG.clientId,
          client_secret: ALEXA_CONFIG.clientSecret
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      
      alexaTokens.accessToken = response.data.access_token;
      alexaTokens.expiresAt = Date.now() + (response.data.expires_in * 1000);
      return alexaTokens.accessToken;
    } catch (error) {
      console.error('Error refrescando token:', error.message);
    }
  }
  
  throw new Error('No hay token de Alexa. Visita /auth/alexa para autenticarte.');
}

async function crearRecordatorioAlexa(mensaje, fecha, hora) {
  try {
    const accessToken = await getAlexaAccessToken();
    
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
      pushNotification: {
        status: "ENABLED"
      }
    };
    
    const response = await axios.post(
      'https://api.amazonalexa.com/v2/alerts/reminders',
      reminderBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Recordatorio creado en Alexa:', response.data);
    return { ok: true, reminderId: response.data.id };
    
  } catch (error) {
    console.error('❌ Error creando recordatorio:', error.response?.data || error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// ENDPOINTS
// ============================================

app.get('/auth/alexa', (req, res) => {
  const authUrl = `https://www.amazon.com/ap/oa?client_id=${ALEXA_CONFIG.clientId}&scope=${encodeURIComponent(ALEXA_CONFIG.scope)}&response_type=code&redirect_uri=${encodeURIComponent(ALEXA_CONFIG.redirectUri)}`;
  res.redirect(authUrl);
});

app.get('/auth/alexa/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send('Error: No se recibió código');
  }
  
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: ALEXA_CONFIG.clientId,
        client_secret: ALEXA_CONFIG.clientSecret,
        redirect_uri: ALEXA_CONFIG.redirectUri
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    alexaTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000)
    };
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: green;">✅ Autenticación exitosa</h1>
          <p>PayTrack ahora puede crear recordatorios en Alexa.</p>
          <p>Los recordatorios llegarán a tu teléfono.</p>
          <p>Ya puedes cerrar esta ventana.</p>
        </body>
      </html>
    `);
  } catch (error) {
    res.send('Error: ' + error.message);
  }
});

app.post("/api/voice/programar", async (req, res) => {
  try {
    const { url, fecha, hora, tarjeta, id } = req.body;
    
    if (!url || !fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }
    
    const fechaHoraProgramada = new Date(`${fecha}T${hora}:00-06:00`);
    const ahora = new Date();
    
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({ ok: false, error: "Fecha/hora ya pasó" });
    }
    
    // Crear recordatorio en Alexa
    const mensajeAlexa = `Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`;
    const alexaResult = await crearRecordatorioAlexa(mensajeAlexa, fecha, hora);
    
    if (!alexaResult.ok) {
      console.warn('⚠️ No se pudo crear recordatorio en Alexa:', alexaResult.error);
    }
    
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    alertas.set(alertaId, { id: alertaId, url, fecha, hora, tarjeta });
    
    const timeoutId = setTimeout(async () => {
      try {
        const fetch = await import('node-fetch');
        await fetch.default(url);
        console.log(`✅ Voice Monkey ejecutado`);
      } catch (e) {
        console.error(`❌ Error: ${e.message}`);
      }
      alertas.delete(alertaId);
    }, msHasta);
    
    alertaTimeouts.set(alertaId, timeoutId);
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta,
      alexa: alexaResult.ok ? "recordatorio_creado" : "fallo"
    });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/voice/disparar-ahora", async (req, res) => {
  try {
    const { url, tarjeta } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: "URL requerida" });
    
    const fetch = await import('node-fetch');
    await fetch.default(url.trim());
    
    res.json({ ok: true, mensaje: "Alerta disparada" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/alexa/prueba-rapida", async (req, res) => {
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    ahora.setSeconds(ahora.getSeconds() + 5);
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    const result = await crearRecordatorioAlexa(mensaje || "Prueba desde PayTrack", fecha, hora);
    res.json({ ok: result.ok, mensaje: result.ok ? "Recordatorio en 5 segundos" : "Error", detalle: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
