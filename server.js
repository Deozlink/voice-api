const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE ALEXA - NUEVA ESTRATEGIA
// ============================================
// 🔄 CAMBIO: Ya no usamos ALEXA_CONFIG para autenticación de usuarios,
//            sino que usamos credenciales fijas de la Skill para crear recordatorios.
//            La autenticación de usuarios es OPCIONAL (para identificar al usuario,
//            pero NO para crear recordatorios).

// ✅ NUEVO: Configuración para la Skill (token fijo)
const SKILL_CONFIG = {
  clientId: process.env.SKILL_CLIENT_ID || 'amzn1.application-oa2-client.489d08207996477db0b5f77f5c7ad0b3',
  clientSecret: process.env.SKILL_CLIENT_SECRET,
  skillId: process.env.SKILL_ID || 'amzn1.ask.skill.339012d5-c0e2-470b-8460-6d109c84360f'
};

// ✅ NUEVO: Token fijo de la Skill (se obtiene una vez y se renueva automáticamente)
let skillAccessToken = {
  token: null,
  expiresAt: null
};

// 🔄 CAMBIO: Configuración de autenticación de usuarios (ahora es OPCIONAL)
//            Se mantiene para que los usuarios puedan iniciar sesión, pero no es necesario
//            para crear recordatorios.
const USER_AUTH_CONFIG = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET,
  redirectUri: 'https://voice-api-dblt-if6d.onrender.com/auth/alexa/callback',
  scope: 'profile'  // Solo profile, sin recordatorios (no los necesitamos aquí)
};

// Almacenamiento de tokens de usuarios (opcional)
let userTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Almacenamiento de alertas
const alertas = new Map();
const alertaTimeouts = new Map();

// ============================================
// FUNCIONES DE ALEXA - NUEVA VERSIÓN CON TOKEN FIJO DE SKILL
// ============================================

// ✅ NUEVO: Obtener token de la Skill (usando client_credentials)
async function getSkillAccessToken() {
  // Si el token aún es válido, devolverlo
  if (skillAccessToken.token && skillAccessToken.expiresAt > Date.now()) {
    return skillAccessToken.token;
  }

  try {
    console.log('🔄 Obteniendo nuevo token de Skill...');
    
    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SKILL_CONFIG.clientId,
        client_secret: SKILL_CONFIG.clientSecret,
        scope: 'alexa::skill:reminders'  // ← Scope correcto para recordatorios
      }).toString()
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    skillAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
    
    console.log('✅ Token de Skill obtenido, expira en:', data.expires_in, 'segundos');
    return skillAccessToken.token;
    
  } catch (error) {
    console.error('❌ Error obteniendo token de Skill:', error.message);
    throw new Error('No se pudo obtener token de Skill. Verifica SKILL_CLIENT_ID y SKILL_CLIENT_SECRET');
  }
}

// ✅ NUEVO: Crear recordatorio usando el token fijo de la Skill
//           Esta función NO necesita que el usuario esté autenticado
async function crearRecordatorioAlexa(mensaje, fecha, hora) {
  try {
    const accessToken = await getSkillAccessToken();
    
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
    
    // ✅ NUEVO: Usar endpoint con skillId y usuario comodín (*)
    //           Esto crea recordatorios para TODOS los usuarios que tengan la skill instalada
    const url = `https://api.amazonalexa.com/v1/skills/${SKILL_CONFIG.skillId}/users/*/reminders`;
    
    const response = await fetch(url, {
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
// FUNCIONES DE AUTENTICACIÓN DE USUARIOS (OPCIONAL)
// ============================================
// Estas funciones se mantienen por si quieres identificar usuarios,
// pero NO son necesarias para crear recordatorios.

async function getUserAccessToken() {
  if (userTokens.accessToken && userTokens.expiresAt > Date.now()) {
    return userTokens.accessToken;
  }
  if (userTokens.refreshToken) {
    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: userTokens.refreshToken,
          client_id: USER_AUTH_CONFIG.clientId,
          client_secret: USER_AUTH_CONFIG.clientSecret
        }).toString()
      });
      const data = await response.json();
      userTokens.accessToken = data.access_token;
      userTokens.refreshToken = data.refresh_token;
      userTokens.expiresAt = Date.now() + (data.expires_in * 1000);
      return userTokens.accessToken;
    } catch (error) {
      console.error('Error refrescando token:', error.message);
    }
  }
  throw new Error('No hay token de usuario. Visita /auth/alexa');
}

// ============================================
// ENDPOINTS
// ============================================

// Endpoint principal
app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

// Endpoint de política de privacidad
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Política de Privacidad - PayTrack</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; color: #333; }
          .container { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          h2 { color: #34495e; margin-top: 20px; }
          .date { color: #7f8c8d; font-size: 0.9em; margin-bottom: 20px; }
          footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.8em; color: #7f8c8d; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Política de Privacidad de PayTrack</h1>
          <div class="date">Última actualización: 24 de marzo de 2026</div>
          <h2>1. Información que recopilamos</h2>
          <p>PayTrack es una aplicación de gestión de pagos con tarjetas de crédito. Para funcionar, utilizamos la API de Alexa para crear recordatorios.</p>
          <h2>2. Cómo usamos tu información</h2>
          <p>La información que recopilamos se utiliza únicamente para programar recordatorios de pago en la fecha y hora que selecciones.</p>
          <p><strong>No almacenamos ni compartimos información personal.</strong></p>
          <h2>3. Seguridad</h2>
          <p>Implementamos medidas de seguridad para proteger tu información. Utilizamos autenticación segura con Amazon.</p>
          <h2>4. Tus derechos</h2>
          <p>Puedes revocar el acceso de PayTrack a tu cuenta de Amazon en cualquier momento desde la configuración de tu cuenta de Amazon.</p>
          <h2>5. Contacto</h2>
          <p>Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en: <strong>soporte@paytrack.com</strong></p>
          <footer><p>PayTrack - Gestión de pagos con tarjetas de crédito</p></footer>
        </div>
      </body>
    </html>
  `);
});

// Endpoint de autenticación de usuarios (OPCIONAL - ya no es necesaria para recordatorios)
app.get('/auth/alexa', (req, res) => {
  const authUrl = `https://www.amazon.com/ap/oa?client_id=${USER_AUTH_CONFIG.clientId}&scope=${encodeURIComponent(USER_AUTH_CONFIG.scope)}&response_type=code&redirect_uri=${encodeURIComponent(USER_AUTH_CONFIG.redirectUri)}`;
  console.log('🔐 Redirigiendo a:', authUrl);
  res.redirect(authUrl);
});

// Callback de autenticación (OPCIONAL)
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
        client_id: USER_AUTH_CONFIG.clientId,
        client_secret: USER_AUTH_CONFIG.clientSecret,
        redirect_uri: USER_AUTH_CONFIG.redirectUri
      }).toString()
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);
    userTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
    console.log('✅ Usuario autenticado, expira en:', data.expires_in, 'segundos');
    res.send(`<html><body style="text-align:center;margin-top:50px;"><h1 style="color:green;">✅ Autenticación exitosa</h1><p>Ya puedes cerrar esta ventana.</p></body></html>`);
  } catch (error) {
    res.send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Verificar estado de autenticación de usuario (OPCIONAL)
app.get('/auth/status', (req, res) => {
  const isAuthed = userTokens.accessToken && userTokens.expiresAt > Date.now();
  res.json({ autenticado: isAuthed, expira: userTokens.expiresAt ? new Date(userTokens.expiresAt).toISOString() : null });
});

// PRUEBA RÁPIDA - crea un recordatorio en 10 segundos usando el token de Skill
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
    
    // ✅ NUEVO: Crear recordatorio usando el token fijo de la Skill
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
  console.log(`🔐 Autenticación de usuarios (opcional): /auth/alexa`);
  console.log(`📊 Estado usuario: /auth/status`);
  console.log(`🧪 Prueba rápida: POST /api/alexa/prueba-rapida`);
  console.log(`📋 Política de privacidad: /privacy`);
  console.log(`✅ Usando token fijo de Skill para recordatorios`);
});
