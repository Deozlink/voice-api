const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN - VERSIÓN SIMPLIFICADA
// ============================================
const ALEXA_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt-if6d.onrender.com/auth/alexa/callback',
  scope: 'profile postal_code'  // Scopes básicos que siempre funcionan
};

let alexaTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// ============================================
// ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

app.get('/auth/alexa', (req, res) => {
  const authUrl = `https://www.amazon.com/ap/oa?client_id=${ALEXA_CONFIG.clientId}&scope=${encodeURIComponent(ALEXA_CONFIG.scope)}&response_type=code&redirect_uri=${encodeURIComponent(ALEXA_CONFIG.redirectUri)}`;
  console.log('Redirigiendo a:', authUrl);
  res.redirect(authUrl);
});

app.get('/auth/alexa/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send('Error: No se recibió código');
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
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: green;">✅ Autenticación exitosa</h1>
          <p>Tu cuenta de Amazon está conectada a PayTrack.</p>
          <p><strong>Access Token:</strong> ${data.access_token.substring(0, 50)}...</p>
          <p>Ya puedes cerrar esta ventana.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error en callback:', error.message);
    res.send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

app.get('/auth/status', (req, res) => {
  const isAuthed = alexaTokens.accessToken && alexaTokens.expiresAt > Date.now();
  res.json({ 
    autenticado: isAuthed,
    expira: alexaTokens.expiresAt ? new Date(alexaTokens.expiresAt).toISOString() : null
  });
});

app.post("/api/voice/disparar-ahora", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: "URL requerida" });
    await fetch(url.trim());
    res.json({ ok: true, mensaje: "Alerta disparada" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
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
    
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    // Programar Voice Monkey
    const timeoutId = setTimeout(async () => {
      try {
        await fetch(url);
        console.log(`✅ Voice Monkey ejecutado para ${alertaId}`);
      } catch (e) {
        console.error(`❌ Error: ${e.message}`);
      }
    }, msHasta);
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta,
      mensaje: "Alerta programada. Próximamente: recordatorio en Alexa"
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`🔐 Autenticación: /auth/alexa`);
});
