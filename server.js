const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE ALEXA
// ============================================

// Variables para almacenar tokens
let alexaTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Almacenamiento de alertas programadas
const alertas = new Map();
const alertaTimeouts = new Map();

// ============================================
// FUNCIONES DE ALEXA
// ============================================

async function getAlexaAccessToken() {
  // Por ahora, esta función se completará después
  throw new Error('Aún no configurado. Primero crea el Security Profile en Amazon.');
}

async function crearRecordatorioAlexa(mensaje, fecha, hora) {
  console.log(`📝 Simulando creación de recordatorio: "${mensaje}" para ${fecha} ${hora}`);
  return { ok: true, reminderId: 'simulado-' + Date.now() };
}

// ============================================
// ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de PayTrack funcionando" });
});

app.post("/api/voice/programar", async (req, res) => {
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
    
    // Guardar alerta
    const msHasta = fechaHoraProgramada - ahora;
    const alertaId = id || Date.now().toString();
    
    alertas.set(alertaId, {
      id: alertaId,
      url,
      fecha,
      hora,
      tarjeta: tarjeta || '—',
      creado: ahora.toISOString()
    });
    
    // Programar Voice Monkey
    const timeoutId = setTimeout(async () => {
      console.log(`🔔 Ejecutando alerta: ${alertaId}`);
      try {
        const fetch = await import('node-fetch');
        await fetch.default(url);
        console.log(`✅ Voice Monkey ejecutado`);
      } catch (e) {
        console.error(`❌ Error Voice Monkey: ${e.message}`);
      }
      alertas.delete(alertaId);
    }, msHasta);
    
    alertaTimeouts.set(alertaId, timeoutId);
    
    res.json({
      ok: true,
      id: alertaId,
      estado: "programada",
      msHasta,
      alexa: alexaResult.ok ? "recordatorio_creado" : "fallo_recordatorio"
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/voice/disparar-ahora", async (req, res) => {
  try {
    const { url, tarjeta } = req.body;
    
    if (!url) {
      return res.status(400).json({ ok: false, error: "URL requerida" });
    }
    
    console.log(`🔔 Disparando alerta inmediata para ${tarjeta || 'prueba'}`);
    
    const fetch = await import('node-fetch');
    const response = await fetch.default(url.trim());
    
    res.json({ 
      ok: true, 
      mensaje: "Alerta disparada inmediatamente",
      status: response.status
    });
    
  } catch (error) {
    console.error("Error:", error.message);
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
    
    console.log(`📅 Programando prueba en 5 segundos: ${fecha} ${hora}`);
    
    const result = await crearRecordatorioAlexa(
      mensaje || "Prueba: este recordatorio fue creado desde tu API",
      fecha,
      hora
    );
    
    res.json({
      ok: result.ok,
      mensaje: result.ok ? "Recordatorio programado en 5 segundos. Revisa la app de Alexa en tu teléfono." : "Error al crear recordatorio",
      detalle: result
    });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📅 Fecha/hora servidor: ${new Date().toISOString()}`);
});