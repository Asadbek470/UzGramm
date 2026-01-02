
import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAIResponse = async (chatName: string, history: Message[]) => {
  try {
    const formattedHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: formattedHistory as any,
      config: {
        systemInstruction: `You are a helpful and friendly Uzbek citizen named ${chatName} on Uzgram, a national messaging app. 
        Always be polite, use traditional greetings like 'Assalomu alaykum'. 
        You can speak Uzbek (O'zbek), Russian (Русский), or English. 
        Promote Uzbek culture and friendliness. Keep responses concise like a chat message.`,
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text || "Uzr, hozir javob bera olmayman.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Aloqa uzildi, qaytadan urinib ko'ring.";
  }
};
