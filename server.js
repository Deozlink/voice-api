// ─── server.js — PayTrack Voice API v4 ──────────────────────────────────────
// Servidor desplegado en Oregon (US West) → UTC-7 / Pacific Time
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import cors    from "cors";
import fetch   from "node-fetch";
import fs      from "fs";
import path    from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERTAS_FILE = path.join(__dirname, "alertas_pendientes.json");

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURACIÓN DE BARK (notificaciones iPhone)
// ============================================
const BARK_URL = process.env.BARK_URL || null;

if (BARK_URL) {
  console.log(`\n📱 BARK CONFIGURADO: ${BARK_URL.substring(0, 50)}...`);
  console.log(`🔔 Las notificaciones se enviarán a tu iPhone\n`);
} else {
  console.log(`\n⚠️  BARK NO CONFIGURADO`);
  console.log(`   Agrega la variable de entorno BARK_URL en Render\n`);
}

app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Alertas en memoria ───────────────────────────────────────────────────────
const alertas = new Map();

function guardarAlertas() {
  try {
    const pendientes = [...alertas.values()]
      .filter(a => a.estado === "programada" || a.estado === "pendiente")
      .map(({ timerId, ...rest }) => rest);
    fs.writeFileSync(ALERTAS_FILE, JSON.stringify(pendientes, null, 2));
  } catch(e) { console.warn("No se pudo guardar alertas:", e.message); }
}

function cargarAlertas() {
  try {
    if(!fs.existsSync(ALERTAS_FILE)) return;
    const pendientes = JSON.parse(fs.readFileSync(ALERTAS_FILE, "utf8"));
    let reagendadas = 0;
    for(const alerta of pendientes) {
      const ms = msHasta(alerta.fecha, alerta.hora);
      if(ms > -60000) {
        alerta.timerId = null;
        alertas.set(alerta.id, alerta);
        agendarAlerta(alerta);
        reagendadas++;
      }
    }
    if(reagendadas > 0)
      console.log(`🔄 Reagendadas ${reagendadas} alerta(s) tras reinicio`);
  } catch(e) { console.warn("No se pudieron cargar alertas:", e.message); }
}

function msHasta(fecha, hora) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm]  = hora.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, 0, 0) - Date.now();
}

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIÓN A BARK
// ============================================
async function enviarNotificacionBark(mensaje, tarjeta, fecha, hora) {
  if (!BARK_URL) {
    console.log(`⚠️  Bark no configurado`);
    return false;
  }
  
  try {
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack`;
    
    const textoLimpio = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\n:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const textoCodificado = encodeURIComponent(textoLimpio);
    
    // Ringtone
    await fetch(`${BARK_URL}/Ringtone?call=1`);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Body
    const response = await fetch(`${BARK_URL}/Body/${textoCodificado}`);
    const result = await response.json();
    
    if (result.code === 200) {
      console.log(`✅ Bark enviado para ${tarjeta}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error Bark: ${error.message}`);
    return false;
  }
}

async function llamarVoiceMonkey(url) {
  console.log(`📢 Voice Monkey: ${url.substring(0, 80)}...`);
  const res  = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`VoiceMonkey ${res.status}`);
  console.log(`✅ Voice Monkey OK`);
  return body;
}

function agendarAlerta(alerta) {
  const ms = msHasta(alerta.fecha, alerta.hora);
  if (ms < 0) { alerta.estado = "vencida"; return; }

  console.log(`[AGENDA] ${alerta.tarjeta} → ${alerta.fecha} ${alerta.hora} UTC (en ${Math.round(ms/1000)}s)`);

  alerta.timerId = setTimeout(async () => {
    console.log(`[DISPARO] ${alerta.tarjeta}`);
    
    try {
      await llamarVoiceMonkey(alerta.url);
      alerta.estado = "ejecutada";
      alerta.ejecutadaEn = new Date().toISOString();
    } catch (e) {
      console.error(`[ERROR] ${e.message}`);
      alerta.estado = "error";
      alerta.error = e.message;
    }
    
    if (BARK_URL) {
      await enviarNotificacionBark(
        `🔔 Recordatorio de pago`,
        alerta.tarjeta,
        alerta.fecha,
        alerta.hora
      );
    }
    
    alerta.timerId = null;
    alertas.set(alerta.id, alerta);
    guardarAlertas();
  }, ms);

  alerta.estado = "programada";
}

// ============================================
// ENDPOINTS
// ============================================

app.get("/api/voice/disparar", async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith("https://api-v2.voicemonkey.io/")) {
    return res.json({ ok: false, error: "URL inválida" });
  }
  try {
    const r = await llamarVoiceMonkey(url);
    return res.json({ ok: true, respuesta: r });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

app.get("/api/voice/programar", (req, res) => {
  const { url, fecha, hora, tarjeta, id } = req.query;

  if (!url || !url.startsWith("https://api-v2.voicemonkey.io/"))
    return res.json({ ok: false, error: "URL inválida" });
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return res.json({ ok: false, error: "fecha inválida" });
  if (!hora || !/^\d{2}:\d{2}$/.test(hora))
    return res.json({ ok: false, error: "hora inválida" });

  const ms = msHasta(fecha, hora);
  if (ms < -300000)
    return res.json({ ok: false, error: `Fecha/hora ya pasó` });

  const alertaId = id || `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

  if (alertas.has(alertaId)) {
    const prev = alertas.get(alertaId);
    if (prev.timerId) clearTimeout(prev.timerId);
  }

  const alerta = {
    id: alertaId,
    url, fecha, hora,
    tarjeta: tarjeta || "—",
    timerId: null,
    estado: "pendiente",
    creadaEn: new Date().toISOString(),
  };

  agendarAlerta(alerta);
  alertas.set(alertaId, alerta);
  guardarAlertas();

  return res.json({ ok: true, id: alertaId, estado: alerta.estado, msHasta: Math.max(ms, 0) });
});

// ============================================
// ENDPOINT PRINCIPAL PARA DISPARAR INMEDIATO
// ============================================
async function manejarDispararAhora(url, mensaje, tarjeta, res) {
  console.log(`\n🔔 DISPARAR AHORA - Tarjeta: ${tarjeta || "prueba"}`);
  
  if(!url || !url.trim()) {
    return res.status(400).json({ ok: false, error: "URL requerida" });
  }
  
  try {
    // Voice Monkey
    console.log(`📢 Voice Monkey...`);
    await llamarVoiceMonkey(url.trim());
    
    // Bark
    if (BARK_URL) {
      console.log(`📱 Bark...`);
      const fecha = new Date().toISOString().split('T')[0];
      const hora = new Date().toTimeString().split(' ')[0].slice(0, 5);
      await enviarNotificacionBark(
        mensaje || "🔔 Alerta de PayTrack",
        tarjeta || "Prueba",
        fecha,
        hora
      );
    }
    
    console.log(`✅ Completado\n`);
    return res.json({ ok: true, mensaje: "Alerta disparada" });
  } catch(e) {
    console.error(`❌ Error: ${e.message}\n`);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

app.post("/api/voice/disparar-ahora", async (req, res) => {
  const { url, mensaje, tarjeta } = req.body;
  return manejarDispararAhora(url, mensaje, tarjeta, res);
});

app.get("/api/voice/disparar-ahora", async (req, res) => {
  const { url, tarjeta } = req.query;
  return manejarDispararAhora(url, null, tarjeta, res);
});

app.get("/api/voice/cancelar", (req, res) => {
  const { id } = req.query;
  const alerta = alertas.get(id);
  if (!alerta) return res.json({ ok: false, error: "Alerta no encontrada" });
  if (alerta.timerId) clearTimeout(alerta.timerId);
  alerta.estado = "cancelada";
  alertas.set(id, alerta);
  guardarAlertas();
  return res.json({ ok: true, id, estado: "cancelada" });
});

app.get("/api/voice/alertas", (_req, res) => {
  const lista = [...alertas.values()].map(a => ({
    id: a.id, tarjeta: a.tarjeta, fecha: a.fecha, hora: a.hora,
    estado: a.estado, creadaEn: a.creadaEn, ejecutadaEn: a.ejecutadaEn || null
  }));
  return res.json({ ok: true, total: lista.length, alertas: lista });
});

app.get("/", (_req, res) => {
  return res.json({
    servicio: "PayTrack Voice API",
    version: "4.0",
    bark: BARK_URL ? "✅ Configurado" : "❌ No configurado",
    endpoints: [
      "POST /api/voice/disparar-ahora",
      "GET /api/voice/programar",
      "GET /api/voice/disparar",
      "GET /api/voice/cancelar",
      "GET /api/voice/alertas"
    ]
  });
});

// ============================================
// INICIO
// ============================================
cargarAlertas();

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 PayTrack API v4 en puerto ${PORT}`);
  console.log(`📍 URL: https://voice-api-dblt-if6d.onrender.com`);
  console.log(`📱 Bark: ${BARK_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
  console.log(`\n🔗 Endpoints disponibles:`);
  console.log(`   POST /api/voice/disparar-ahora`);
  console.log(`   GET  /api/voice/programar`);
  console.log(`   GET  /api/voice/disparar`);
  console.log(`\n`);
});
