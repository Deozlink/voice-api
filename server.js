const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración
const ALEXA_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt-if6d.onrender.com/auth/alexa/callback',
  scope: 'alexa:alerts:reminders:skill:readwrite profile'
};

let alexaTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Función para obtener token
async function getAlexaAccessToken() {
  if (alexaTokens.accessToken && alexaTokens.expiresAt > Date.now()) {
    return alexaTokens.accessToken;
  }
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

// Función para crear recordatorio
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
    if (!response.ok) throw new Error(data.message || 'Error');
    return { ok: true, reminderId: data.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ========== ENDPOINTS ==========

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

app.get('/auth/alexa', (req, res) => {
  const authUrl = `https://www.amazon.com/ap/oa?client_id=${ALEXA_CONFIG.clientId}&scope=${encodeURIComponent(ALEXA_CONFIG.scope)}&response_type=code&redirect_uri=${encodeURIComponent(ALEXA_CONFIG.redirectUri)}`;
  res.redirect(authUrl);
});

app.get('/auth/alexa/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('Error: No se recibió código');
  
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
    alexaTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
    res.send(`
      <html><body style="text-align:center;margin-top:50px;">
        <h1 style="color:green;">✅ Autenticación exitosa</h1>
        <p>PayTrack puede crear recordatorios en Alexa.</p>
        <p>Ya puedes cerrar esta ventana.</p>
      </body></html>
    `);
  } catch (error) {
    res.send('Error: ' + error.message);
  }
});

app.get('/auth/status', (req, res) => {
  const isAuthed = alexaTokens.accessToken && alexaTokens.expiresAt > Date.now();
  res.json({ autenticado: isAuthed, expira: alexaTokens.expiresAt ? new Date(alexaTokens.expiresAt).toISOString() : null });
});

// ✅ ENDPOINT DE PRUEBA RÁPIDA
app.post('/api/alexa/prueba-rapida', async (req, res) => {
  try {
    const { mensaje } = req.body;
    const ahora = new Date();
    ahora.setSeconds(ahora.getSeconds() + 10);
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0].slice(0, 5);
    
    console.log(`📅 Prueba: ${fecha} ${hora}`);
    const result = await crearRecordatorioAlexa(mensaje || "Prueba desde PayTrack", fecha, hora);
    res.json({ ok: result.ok, mensaje: result.ok ? "Recordatorio en 10 segundos" : "Error", detalle: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/programar', async (req, res) => {
  try {
    const { url, fecha, hora, tarjeta } = req.body;
    if (!url || !fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }
    
    const fechaHora = new Date(`${fecha}T${hora}:00-06:00`);
    if (fechaHora < new Date()) {
      return res.status(400).json({ ok: false, error: "Fecha/hora ya pasó" });
    }
    
    const alexaResult = await crearRecordatorioAlexa(`Recordatorio de pago para ${tarjeta || 'tu tarjeta'}`, fecha, hora);
    
    const msHasta = fechaHora - new Date();
    setTimeout(async () => {
      try { await fetch(url); console.log('✅ Voice Monkey ejecutado'); } catch (e) { console.error('Error:', e.message); }
    }, msHasta);
    
    res.json({ ok: true, alexa: alexaResult.ok ? "recordatorio_creado" : "fallo" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/voice/disparar-ahora', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: "URL requerida" });
    await fetch(url.trim());
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
});
