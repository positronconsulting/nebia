// archivo: /pages/api/analizar-test.js (NEBIA)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.positronconsulting.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const {
      respuestas,
      comentarioLibre,
      correo,
      nombre,
      institucion,
      tipoInstitucion,
      temasValidos,
      edad,
      genero,
      rol
    } = req.body;

    console.log("📥 Data recibida en analizar-test NEBIA:", {
      correo, institucion, tipoInstitucion, nombre, edad, genero, rol, temasValidos, comentarioLibre, respuestas
    });

    const apiKey = process.env.OPENAI_API_KEY;

    const prompt = `
Eres NEBIA, la mejor psicóloga del mundo especializada en salud mental aeronáutica. Tienes entrenamiento clínico avanzado en psicometría, salud mental y análisis emocional. Acabas de aplicar un test inicial a un(a) ${rol} de género ${genero}, de ${edad} años, que respondió una serie de reactivos tipo Likert ("Nunca", "Casi nunca", "A veces", "Casi siempre", "Siempre") sobre los siguientes temas emocionales:

${temasValidos.join(", ")}

Además, el usuario escribió un comentario libre al final.

Tu tarea es:

1. Analizar clínicamente las respuestas según criterios de escalas estandarizadas como:
   - PHQ-9 (depresión)
   - GAD-7 (ansiedad)
   - C-SSRS y Escala de desesperanza de Beck (suicidio)
   - AUDIT y ASSIST (consumo)
   - PSS (estrés)
   - Maslach Burnout Inventory (burnout)
   - SCL-90-R (síntomas generales)
   - Rosenberg (autoestima)
   - IAT (adicciones digitales)
   - PSQI (sueño)
   - Escala de Soledad UCLA
   - Y-BOCS (TOC)

2. SIEMPRE asigna una calificación emocional del 1 al 100 para cada tema mencionado.

3. Redacta un perfil emocional con lenguaje empático, humano y profesional. Que refleje el estado emocional del usuario sin tecnicismos ni juicios.

4. IMPORTANTÍSIMO: si detectas señales o palabras como suicidio, crisis, acoso, encierro, burnout severo, bulimia, anorexia, violación, luto, pérdida o ideas de muerte, escribe exactamente: "SOS". Si no, escribe "OK".

Devuelve un JSON como este:
{
  "calificaciones": {
    "Tema1": 94,
    "Tema2": 73
  },
  "perfil": "Texto empático y humano",
  "SOS": "OK" // o "SOS"
}

Respuestas del usuario:
${JSON.stringify(respuestas, null, 2)}

Comentario libre:
"${comentarioLibre}"
    `.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await openAiResponse.json();
    console.log("📩 Respuesta de OpenAI NEBIA:", data);

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ ok: false, error: "Respuesta vacía de OpenAI" });
    }

    let resultado;
    try {
      resultado = JSON.parse(data.choices[0].message.content);
      console.log("✅ JSON interpretado:", resultado);
    } catch (err) {
      console.error("❌ Error al parsear JSON:", err);
      return res.status(500).json({ ok: false, error: "Formato inválido en la respuesta del modelo" });
    }

    // Registrar tokens en Google Sheets NEBIA
    const usage = data.usage || {};
    const costoUSD = usage.total_tokens ? usage.total_tokens * 0.00001 : 0;

    try {
      await fetch("https://script.google.com/macros/s/AKfycbwcdVoj4E3Yqi954UfyQldrvEUsNxC_6Ls33XwKVZYNj5ekAaReh_P7jPUNzZMNS9_N/exec", {
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
      console.log("🧾 Tokens registrados correctamente en NEBIA.");
    } catch (e) {
      console.warn("⚠️ Error al registrar tokens NEBIA:", e.message);
    }

    return res.status(200).json({
      ok: true,
      calificaciones: resultado.calificaciones || {},
      perfil: resultado.perfil || "",
      SOS: resultado.SOS || "OK",
      usage
    });

  } catch (err) {
    console.error("🔥 Error en analizar-test NEBIA:", err);
    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
}

