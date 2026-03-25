// ─── server.js — PayTrack Voice API v4 ──────────────────────────────────────
// Servidor desplegado en Oregon (US West) → UTC-7 / Pacific Time
// El frontend (CDMX, UTC-6) envía la hora ya ajustada -1h (Oregon es 1h atrás de CDMX).
// Ej: usuario programa 09:00 CDMX → frontend envía 08:00 → servidor dispara 08:00 Oregon = 09:00 CDMX ✓
// 
// ✅ NUEVO: Soporte para Bark (notificaciones push a iPhone)
// ✅ NUEVO: Variable de entorno BARK_URL
// ✅ NUEVO: Logs detallados para depuración
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import fetch   from "node-fetch";
import fs      from "fs";
import path    from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERTAS_FILE = path.join(__dirname, "alertas_pendientes.json");

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURACIÓN DE BARK (notificaciones iPhone)
// ============================================
// Obtener URL de Bark desde variable de entorno
// Ejemplo en Render: BARK_URL = https://api.day.app/RhWJo5Dc2gLkr9ayK4RHwR
const BARK_URL = process.env.BARK_URL || null;

if (BARK_URL) {
  console.log(`\n📱 BARK CONFIGURADO: ${BARK_URL}`);
  console.log(`🔔 Las notificaciones se enviarán a tu iPhone\n`);
} else {
  console.log(`\n⚠️  BARK NO CONFIGURADO`);
  console.log(`   Agrega la variable de entorno BARK_URL en Render`);
  console.log(`   Ejemplo: BARK_URL = https://api.day.app/tu-clave-unica\n`);
}

// CORS abierto — necesario para que el browser lea la respuesta GET
app.use(cors({ origin: "*" }));
app.use(express.json()); // para recibir POST con JSON del frontend

// ── Alertas en memoria ───────────────────────────────────────────────────────
const alertas = new Map();

// ── Persistencia en disco — sobrevive reinicios de Render ────────────────────
function guardarAlertas() {
  try {
    const pendientes = [...alertas.values()]
      .filter(a => a.estado === "programada" || a.estado === "pendiente")
      .map(({ timerId, ...rest }) => rest); // no serializar timerId
    fs.writeFileSync(ALERTAS_FILE, JSON.stringify(pendientes, null, 2));
  } catch(e) { console.warn("No se pudo guardar alertas en disco:", e.message); }
}

function cargarAlertas() {
  try {
    if(!fs.existsSync(ALERTAS_FILE)) return;
    const pendientes = JSON.parse(fs.readFileSync(ALERTAS_FILE, "utf8"));
    const ahora = Date.now();
    let reagendadas = 0;
    for(const alerta of pendientes) {
      const ms = msHasta(alerta.fecha, alerta.hora);
      if(ms > -60000) { // no más de 1 minuto en el pasado
        alerta.timerId = null;
        alertas.set(alerta.id, alerta);
        agendarAlerta(alerta);
        reagendadas++;
      }
    }
    if(reagendadas > 0)
      console.log(`🔄 Reagendadas ${reagendadas} alerta(s) tras reinicio del servidor`);
  } catch(e) { console.warn("No se pudieron cargar alertas:", e.message); }
}

// ── ms hasta fecha+hora en UTC (el frontend envía todo en UTC) ───────────────
function msHasta(fecha, hora) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm]  = hora.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, 0, 0) - Date.now();
}

// ============================================
// FUNCIÓN PARA ENVIAR NOTIFICACIÓN A BARK (iPhone)
// ============================================
async function enviarNotificacionBark(mensaje, tarjeta, fecha, hora) {
  if (!BARK_URL) {
    console.log(`⚠️  Bark no configurado, omitiendo notificación`);
    return false;
  }
  
  try {
    const texto = `${mensaje}\n\nTarjeta: ${tarjeta || 'No especificada'}\nFecha: ${fecha || 'No especificada'}\nHora: ${hora || 'No especificada'}\n\nPayTrack - Gestión de pagos`;
    
    // Limpiar texto (eliminar acentos y caracteres especiales)
    const textoLimpio = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\n:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const textoCodificado = encodeURIComponent(textoLimpio);
    
    // Enviar a Bark (primero ringtone, luego body)
    const ringtoneUrl = `${BARK_URL}/Ringtone?call=1`;
    await fetch(ringtoneUrl);
    
    // Pequeña pausa
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const bodyUrl = `${BARK_URL}/Body/${textoCodificado}`;
    const response = await fetch(bodyUrl);
    const result = await response.json();
    
    if (result.code === 200) {
      console.log(`✅ Notificación Bark enviada para ${tarjeta}`);
      return true;
    } else {
      console.warn(`⚠️ Bark respondió: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error enviando a Bark: ${error.message}`);
    return false;
  }
}

// ── Llamar a Voice Monkey (desde el servidor, sin CORS) ──────────────────────
async function llamarVoiceMonkey(url) {
  console.log(`📢 Llamando a Voice Monkey: ${url.substring(0, 80)}...`);
  const res  = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`VoiceMonkey ${res.status}: ${body}`);
  console.log(`✅ Voice Monkey OK: ${body.substring(0, 100)}`);
  return body;
}

// ── Agendar setTimeout ───────────────────────────────────────────────────────
function agendarAlerta(alerta) {
  const ms = msHasta(alerta.fecha, alerta.hora);
  if (ms < 0) { alerta.estado = "vencida"; return; }

  console.log(`[AGENDA] ${alerta.tarjeta} → ${alerta.fecha} ${alerta.hora} UTC (en ${Math.round(ms/1000)}s) | Ahora UTC: ${new Date().toISOString()}`);

  alerta.timerId = setTimeout(async () => {
    console.log(`[DISPARO] ${alerta.tarjeta} a las ${new Date().toLocaleString()}`);
    
    // 1. Enviar a Voice Monkey
    try {
      const r = await llamarVoiceMonkey(alerta.url);
      console.log(`[OK Voice Monkey] ${r.substring(0, 100)}`);
      alerta.estado      = "ejecutada";
      alerta.ejecutadaEn = new Date().toISOString();
    } catch (e) {
      console.error(`[ERROR Voice Monkey] ${e.message}`);
      alerta.estado = "error";
      alerta.error  = e.message;
    }
    
    // 2. Enviar notificación a Bark (iPhone)
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

// ════════════════════════════════════════════════════════════════════════════
// GET /api/voice/disparar?url=...
// Dispara Voice Monkey de inmediato — GET simple, sin preflight CORS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/voice/disparar", async (req, res) => {
  console.log("📥 GET /disparar recibido:", {
    device: (() => { try { return new URL(req.query.url||"").searchParams.get("device"); } catch { return "?"; } })(),
    timestamp: new Date().toISOString(),
  });
  const { url } = req.query;

  if (!url || !url.startsWith("https://api-v2.voicemonkey.io/")) {
    return res.json({ ok: false, error: "URL de VoiceMonkey inválida" });
  }

  try {
    const r = await llamarVoiceMonkey(url);
    console.log(`[DISPARAR] OK → device: ${new URL(url).searchParams.get("device")}`);
    return res.json({ ok: true, respuesta: r });
  } catch (e) {
    console.error(`[DISPARAR] ERROR: ${e.message}`);
    return res.json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/voice/programar?url=...&fecha=YYYY-MM-DD&hora=HH:MM&tarjeta=...&id=...
// Agenda alerta — GET simple, sin preflight CORS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/voice/programar", (req, res) => {
  console.log("📥 GET /programar recibido:", {
    ...req.query,
    url: req.query.url ? req.query.url.substring(0,60)+"..." : undefined,
    timestamp: new Date().toISOString(),
    horaOregon: new Date().toLocaleString("es-MX",{timeZone:"America/Los_Angeles"}),
  });
  const { url, fecha, hora, tarjeta, id } = req.query;

  if (!url || !url.startsWith("https://api-v2.voicemonkey.io/"))
    return res.json({ ok: false, error: "URL de VoiceMonkey inválida" });
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return res.json({ ok: false, error: "fecha inválida (YYYY-MM-DD)" });
  if (!hora || !/^\d{2}:\d{2}$/.test(hora))
    return res.json({ ok: false, error: "hora inválida (HH:MM)" });

  const ms = msHasta(fecha, hora);
  if (ms < -300000) // rechazar solo si pasó hace más de 5 minutos
    return res.json({ ok: false, error: `Fecha/hora ya pasó (hace ${Math.round(-ms/1000)}s)` });

  const alertaId = id || `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

  // Cancelar alerta previa con el mismo id
  if (alertas.has(alertaId)) {
    const prev = alertas.get(alertaId);
    if (prev.timerId) clearTimeout(prev.timerId);
  }

  const alerta = {
    id: alertaId,
    url, fecha, hora,
    tarjeta:  tarjeta || "—",
    timerId:  null,
    estado:   "pendiente",
    creadaEn: new Date().toISOString(),
  };

  agendarAlerta(alerta);
  alertas.set(alertaId, alerta);
  guardarAlertas();

  console.log(`[PROGRAMAR] id=${alertaId} tarjeta=${alerta.tarjeta} ${fecha} ${hora} (en ${Math.max(0,Math.round(ms/1000))}s)`);
  return res.json({ ok: true, id: alertaId, estado: alerta.estado, msHasta: Math.max(ms, 0) });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/voice/disparar-ahora  { url, mensaje, tarjeta }
// GET  /api/voice/disparar-ahora?url=...&tarjeta=...   (retrocompat)
// Dispara inmediatamente y envía notificación a Bark
// ════════════════════════════════════════════════════════════════════════════
async function manejarDispararAhora(url, mensaje, tarjeta, res) {
  console.log(`\n🔔 ========== DISPARAR AHORA ==========`);
  console.log(`📱 Tarjeta: ${tarjeta || "prueba"}`);
  console.log(`📝 Mensaje: ${mensaje || "Alerta inmediata"}`);
  console.log(`🔗 URL: ${url ? url.substring(0, 80) + "..." : "no proporcionada"}`);
  
  if(!url || !url.trim()) {
    console.log(`❌ Error: URL requerida`);
    return res.status(400).json({ ok: false, error: "URL requerida" });
  }
  
  try {
    // 1. Disparar Voice Monkey
    console.log(`📢 Disparando Voice Monkey...`);
    const voiceResult = await llamarVoiceMonkey(url.trim());
    console.log(`✅ Voice Monkey OK`);
    
    // 2. Enviar notificación a Bark (iPhone)
    if (BARK_URL) {
      console.log(`📱 Enviando notificación a Bark...`);
      const fecha = new Date().toISOString().split('T')[0];
      const hora = new Date().toTimeString().split(' ')[0].slice(0, 5);
      await enviarNotificacionBark(
        mensaje || "🔔 Alerta inmediata de PayTrack",
        tarjeta || "Prueba",
        fecha,
        hora
      );
      console.log(`✅ Bark enviado`);
    } else {
      console.log(`⚠️  Bark no configurado, omitiendo notificación`);
    }
    
    console.log(`✅ Alerta inmediata completada\n`);
    return res.json({ ok: true, mensaje: "Alerta disparada inmediatamente", via: "backend" });
  } catch(e) {
    console.error(`❌ Error en disparar-ahora: ${e.message}`);
    console.log(`\n`);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// POST — el frontend usa POST con JSON body
app.post("/api/voice/disparar-ahora", async (req, res) => {
  console.log("📥 POST /disparar-ahora recibido");
  const { url, mensaje, tarjeta } = req.body;
  return manejarDispararAhora(url, mensaje, tarjeta, res);
});

// GET — compatibilidad retroactiva con versiones anteriores
app.get("/api/voice/disparar-ahora", async (req, res) => {
  console.log("📥 GET /disparar-ahora recibido");
  const { url, tarjeta } = req.query;
  return manejarDispararAhora(url, null, tarjeta, res);
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/voice/cancelar?id=...
// Cancela alerta — GET simple para evitar preflight CORS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/voice/cancelar", (req, res) => {
  console.log("📥 GET /cancelar recibido:", { id: req.query.id, timestamp: new Date().toISOString() });
  const { id } = req.query;
  const alerta = alertas.get(id);

  if (!alerta) return res.json({ ok: false, error: "Alerta no encontrada" });

  if (alerta.timerId) { clearTimeout(alerta.timerId); alerta.timerId = null; }
  alerta.estado = "cancelada";
  alertas.set(id, alerta);
  guardarAlertas();

  console.log(`[CANCELAR] id=${id}`);
  return res.json({ ok: true, id, estado: "cancelada" });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/voice/alertas — lista alertas (debug)
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/voice/alertas", (_req, res) => {
  const lista = [...alertas.values()].map(a => ({
    id:          a.id,
    tarjeta:     a.tarjeta,
    fecha:       a.fecha,
    hora:        a.hora,
    estado:      a.estado,
    creadaEn:    a.creadaEn,
    ejecutadaEn: a.ejecutadaEn || null,
    error:       a.error || null,
    device: (() => { try { return new URL(a.url).searchParams.get("device"); } catch { return "?"; } })(),
  }));
  return res.json({ ok: true, total: lista.length, alertas: lista });
});

// ════════════════════════════════════════════════════════════════════════════
// GET / — Health check
// ════════════════════════════════════════════════════════════════════════════
app.get("/", (_req, res) => {
  const ahora = new Date();
  return res.json({
    servicio: "PayTrack Voice API",
    version:  "4.0.0",
    bark:     BARK_URL ? "✅ Configurado" : "❌ No configurado",
    bark_url: BARK_URL ? BARK_URL.substring(0, 30) + "..." : null,
    horaServidor: ahora.toLocaleString("es-MX", { timeZone: "America/Los_Angeles" }) + " (Oregon/Pacific)",
    horaUTC: ahora.toISOString(),
    alertasEnMemoria: alertas.size,
    endpoints: [
      "GET /api/voice/disparar?url=...",
      "GET /api/voice/programar?url=...&fecha=...&hora=...&tarjeta=...&id=...",
      "POST /api/voice/disparar-ahora (JSON body)",
      "GET /api/voice/disparar-ahora?url=...&tarjeta=...",
      "GET /api/voice/cancelar?id=...",
      "GET /api/voice/alertas",
      "GET /"
    ]
  });
});

// Cargar alertas pendientes del disco antes de escuchar
cargarAlertas();

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 PayTrack Voice API v4 → puerto ${PORT}`);
  console.log(`========================================`);
  console.log(`🕐 Servidor iniciado: ${new Date().toISOString()}`);
  console.log(`🌍 Hora Oregon/Pacific: ${new Date().toLocaleString('es-MX', {timeZone:'America/Los_Angeles'})}`);
  console.log(`\n📱 Bark: ${BARK_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
  if (BARK_URL) {
    console.log(`   URL: ${BARK_URL.substring(0, 50)}...`);
  } else {
    console.log(`   Agrega la variable BARK_URL en Render`);
  }
  console.log(`\n🔗 Endpoints disponibles:`);
  console.log(`   GET  /api/voice/disparar?url=...`);
  console.log(`   GET  /api/voice/programar?url=...&fecha=...&hora=...`);
  console.log(`   POST /api/voice/disparar-ahora`);
  console.log(`   GET  /api/voice/cancelar?id=...`);
  console.log(`   GET  /api/voice/alertas`);
  console.log(`   GET  /`);
  console.log(`\n`);
});
