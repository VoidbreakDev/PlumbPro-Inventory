import { InventoryItem, Job, SmartOrderSuggestion } from "../types";
import { smartOrderingAPI } from "../lib/api";

export async function getSmartOrderingSuggestions(
  _inventory: InventoryItem[],
  _upcomingJobs: Job[]
): Promise<SmartOrderSuggestion[]> {
  try {
    const { suggestions } = await smartOrderingAPI.getSuggestions();
    return suggestions;
  } catch (error) {
    console.error("Smart ordering suggestion error:", error);
    return [];
  }
}
