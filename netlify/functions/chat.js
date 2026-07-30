// Este archivo es "el mesero" de Santis. Corre solo, en el hosting,
// nunca en el navegador del usuario. Ahora le habla a Groq (que corre
// modelos abiertos tipo Llama, gratis y sin tarjeta), en vez de a
// Gemini, porque Gemini tiene un quilombo de llaves roto en este
// momento del lado de Google.

const MODEL = "llama-3.3-70b-versatile";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método no permitido" };
  }

  try {
    // Esto es lo que la página le mandó al mesero: el historial de
    // la charla y las instrucciones de personalidad.
    const { messages, system } = JSON.parse(event.body);

    // Groq habla el mismo "idioma" que OpenAI: un array de mensajes
    // con role/content, donde el system prompt es un mensaje más,
    // el primero de la lista. Mucho más simple que Gemini acá.
    const chatMessages = [
      { role: "system", content: system },
      ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
      }),
    });

    const data = await response.json();

    // Si se acabó la cuota gratis del día/minuto, Groq devuelve 429.
    if (response.status === 429) {
      return {
        statusCode: 429,
        body: JSON.stringify({ quotaExceeded: true }),
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: { message: (data.error && data.error.message) || "Error de Groq" },
        }),
      };
    }

    const reply =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";

    // Devolvemos la respuesta en el mismo formato que ya entendía la
    // página (el mismo que usa Anthropic), para no tocar el resto del código.
    return {
      statusCode: 200,
      body: JSON.stringify({ content: [{ type: "text", text: reply }] }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: "El mesero se tropezó: " + err.message } }),
    };
  }
};
