const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN - CON SKILL ID
// ============================================
const ALEXA_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt-if6d.onrender.com/auth/alexa/callback',
  scope: 'alexa:alerts:reminders:skill:readwrite profile',
  skillId: 'amzn1.ask.skill.TU_SKILL_ID_AQUI'  // ⚠️ PON TU SKILL ID AQUÍ
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

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

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
    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: ALEXA_CONFIG.clientId,
        client_secret: ALEXA_CONFIG.clientSecret,
        redirect_uri: ALEXA_CONFIG
