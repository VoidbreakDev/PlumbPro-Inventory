
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Job, SmartOrderSuggestion } from "../types";

export async function getSmartOrderingSuggestions(
  inventory: InventoryItem[],
  upcomingJobs: Job[]
): Promise<SmartOrderSuggestion[]> {
  // Always create a new instance before making an API call to ensure current configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    As an expert inventory manager for a plumbing company, analyze the current stock and upcoming jobs.
    Suggest which items need to be ordered to fulfill the upcoming jobs and maintain healthy stock levels.
    
    Upcoming Jobs: ${JSON.stringify(upcomingJobs.map(j => ({ title: j.title, date: j.date, type: j.jobType })))}
    Current Inventory: ${JSON.stringify(inventory.map(i => ({ name: i.name, id: i.id, qty: i.quantity, reorder: i.reorderLevel })))}
    
    Consider:
    1. Items currently below or near their reorderLevel.
    2. Items likely needed for the listed job types (e.g., Installation jobs need pipes and fittings).
    3. Seasonal demand or common sense bulk needs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              itemName: { type: Type.STRING },
              suggestedQuantity: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ["itemId", "itemName", "suggestedQuantity", "reason"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
}
