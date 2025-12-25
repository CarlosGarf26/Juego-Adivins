import { GoogleGenAI, Type } from "@google/genai";
import { WordCard, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
Eres un experto en cultura popular mexicana, específicamente de la Ciudad de México (CDMX/Chilango).
Tu tarea es generar palabras o frases coloquiales ("jerga" o "slang") para un juego de adivinanzas tipo "Heads Up" o "Charadas".
Las palabras deben ser divertidas y culturalmente relevantes.
`;

export const fetchSlangWords = async (difficulty: Difficulty): Promise<WordCard[]> => {
  let promptContext = "";
  
  switch (difficulty) {
    case 'facil':
      promptContext = "palabras comunes y conocidas por cualquier mexicano (ej. Tacos, Metro, Chamba).";
      break;
    case 'barrio':
      promptContext = "jerga callejera típica de la CDMX, nivel medio (ej. Chale, Cámara, Pachanga).";
      break;
    case 'experto':
      promptContext = "jerga ñera, albur o frases complejas muy chilangas (ej. Sepa la bola, A darle que es mole de olla).";
      break;
  }

  const prompt = `Genera una lista de 15 palabras o frases coloquiales de la Ciudad de México. 
  Nivel de 'barrio': ${difficulty}. Contexto: ${promptContext}.
  Incluye una definición breve y un ejemplo de uso para ayudar a quienes describen la palabra.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "La palabra o frase a adivinar" },
              definition: { type: Type.STRING, description: "Breve significado" },
              example: { type: Type.STRING, description: "Ejemplo corto de uso" }
            },
            required: ["word", "definition", "example"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text) as WordCard[];
    return data;

  } catch (error) {
    console.error("Error fetching words:", error);
    // Fallback data in case of API failure
    return [
      { word: "Chale", definition: "Expresión de decepción o sorpresa", example: "¡Chale, se me olvidó la cartera!" },
      { word: "Cámara", definition: "Acuerdo, despedida o advertencia", example: "Cámara, nos vemos mañana." },
      { word: "Guajolota", definition: "Torta de tamal", example: "Me desayuné una guajolota." },
      { word: "Micer", definition: "Chofer de microbús", example: "El micer iba bien rápido." },
      { word: "Chamba", definition: "Trabajo", example: "Tengo mucha chamba hoy." }
    ];
  }
};