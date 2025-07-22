// pages/api/aurea.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.positronconsulting.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Preflight
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const { mensaje, correo, tipoInstitucion, nombre, institucion, historial = [], calificaciones = [], tema = "", calificacion = "", porcentaje = "", temas = [] } = req.body;

    console.log("📥 Data recibida en Aurea:", {
      mensaje,
      correo,
      tipoInstitucion,
      nombre,
      institucion,
      historial,
      calificaciones,
      tema,
      calificacion,
      porcentaje,
      temas
    });

    const apiKey = process.env.OPENAI_API_KEY;

    const prompt = `
Eres AUREA, el mejor psicoterapeuta del mundo y el mayor experto en terapia cognitivo conductual, enfoque neurocognitivo conductual y psicoterapia Gestalt. Tu estilo es cercano, claro y humano. Actúa como si ya estuvieras conversando con la persona desde hace un rato y hay fluidez en la conversación.
Tu objetivo es ayudar a las personas a explorar lo que sienten, identificar emociones y reflexionar sobre su bienestar y tu objetivo es contribuir a crar un primer acercamiento clínico útil para construir un perfil psicológico inicial que permita un seguimiento y una respuesta más personalizada, sin emitir diagnósticos ni asumir certezas absolutas.
Responde solo sobre temas de salud emocional. Si el usuario pide algo fuera de tu rol, indícalo con respeto.

${nombre} mandó este mensaje: ${mensaje}, y este es el historial de la conversación: ${JSON.stringify(historial)}. Analiza las palabras textuales y el contexto, como el mejor psicólogo del mundo, basándote en el DSM-5 y protocolos de Terapia Cognitivo Conductual y relaciónalo con un tema de estos: ${temas.join(", ")}. Si no encuentras una relación directa, hazlo por análisis clínico al que más se acerque o que podría relacionarse si tuvieras más información, pero sólo a esos temas.

Utiliza también las calificaciones anteriores: ${JSON.stringify(calificaciones)}, el tema previo: ${tema}, la calificación previa: ${calificacion} y el porcentaje de certeza previo: ${porcentaje}. Define de entre los mejores tests psicológicos, como PHQ-9, GAD-7, C-SSRS, ASSIST, AUDIT, IAT, Rosenberg, PSS, PSQI, UCLA, SCL-90-R, BAI o BDI-II o cualquier otro al que tengas acceso, cuál es el mejor para el tema detectado y úsalo para asignar una calificación del 1 al 100 que represente la intensidad probable del malestar. Esta calificación puede ayudar a enriquecer el perfil emocional que puede afinarse con nuevas interacciones. También define una calificación de certeza que represente qué tan seguro estás de poder asignar esa calificación. Si tu calificación de certeza es mayor a 80%, ofrece un mensaje de acompañamiento y considera que puedesa usar esta información como parte del perfil inicial de la persona. Si es menor a 90%, ofrece un mensaje de acompañamiento y agrega una pregunta basada en el test psicológico correspondiente y técnicas de TCC teniendo siempre el objetivo de mejorar la calificación de certeza y mejorar tu comprensión en futuras interacciones.

Nunca empieces los mensajes de la misma forma que los anteriores. Necesito que no uses respuestas genéricas y repetitivas. El usuario no debe sospechar que está hablando con una IA.

IMPORTANTÍSIMO: Siempre que detectes señales o palabras literales de crisis emocional, suicidio, burnout, peligro, peligro físico, encierro, acoso, bullying, bulimia, anorexia, violación, ludopatía o trastornos alimenticios, escribe exactamente: "SOS". Si no detectas señales de este tipo, escribe exactamente: "OK".

Usa este formato JSON:

{
  "mensajeUsuario": "Aquí va la respuesta de AUREA",
  "temaDetectado": "tema que hayas detectado de entre los 11 que te compartí",
  "calificacion": "calificación al tema basada en el test psicológico, asignada del 1 al 100",
  "porcentaje": "Calificación de certeza del 1 al 100",
  "testUsado": "test que hayas usado para asignar calificación y porcentaje de certeza. Si no usaste uno en específico, asigna uno al que se relacione más, pero jamás puede ser un test desconocido",
  "SOS": "SOS o OK"
}
`.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await openAiResponse.json();
    console.log("📩 Respuesta de OpenAI cruda:", data);

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ ok: false, error: "Respuesta vacía de OpenAI" });
    }

    let json;
    try {
      json = JSON.parse(data.choices[0].message.content);
    } catch (err) {
      console.error("❌ No se pudo parsear JSON:", err);
      return res.status(500).json({ ok: false, error: "Formato inválido en la respuesta de OpenAI" });
    }

    const usage = data.usage || {};
    const costoUSD = usage.total_tokens ? usage.total_tokens * 0.00001 : 0;

    await fetch("https://script.google.com/macros/s/AKfycbyHn1qrFocq0pkjujypoB-vK7MGmGFz6vH4t2qVfHcziTcuMB3abi3UegPGdNno3ibULA/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: new Date().toISOString(),
        usuario: correo,
        institucion,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        costoUSD: parseFloat(costoUSD.toFixed(6))
      })
    });

    console.log("✅ JSON interpretado:", json);

    return res.status(200).json({
      ok: true,
      mensajeUsuario: json.mensajeUsuario || "🤖 Respuesta vacía.",
      temaDetectado: json.temaDetectado || "",
      calificacion: json.calificacion || "",
      porcentaje: json.porcentaje || "",
      SOS: json.SOS || "OK"
    });

  } catch (err) {
    console.error("🔥 Error en aurea.js:", err);
    return res.status(500).json({ ok: false, error: "Error interno en AUREA" });
  }
}

