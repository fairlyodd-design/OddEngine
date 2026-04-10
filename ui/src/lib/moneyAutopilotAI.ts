
import { RevenueRecord } from "./publisherAnalyticsBridge";

export type MoneySuggestion = {
  id: string;
  type: "scale" | "fix" | "stop" | "test";
  message: string;
  score: number;
};

export function analyzeRevenue(records: RevenueRecord[]): MoneySuggestion[] {
  const suggestions: MoneySuggestion[] = [];

  records.forEach(r => {
    const convRate = r.clicks ? (r.conversions || 0) / r.clicks : 0;
    const rev = r.revenue || 0;

    if (rev > 50 && convRate > 0.1) {
      suggestions.push({
        id: r.id,
        type: "scale",
        score: 90,
        message: `Scale ${r.title} on ${r.provider} — high revenue + strong conversion`,
      });
    } else if (r.clicks && convRate < 0.03) {
      suggestions.push({
        id: r.id,
        type: "fix",
        score: 70,
        message: `Improve conversion for ${r.title} — traffic exists but not converting`,
      });
    } else if (rev < 5 && (r.views || 0) > 200) {
      suggestions.push({
        id: r.id,
        type: "stop",
        score: 60,
        message: `Low ROI on ${r.title} — consider stopping or pivoting`,
      });
    } else {
      suggestions.push({
        id: r.id,
        type: "test",
        score: 50,
        message: `Test variations of ${r.title} — inconclusive performance`,
      });
    }
  });

  return suggestions.sort((a,b)=>b.score-a.score);
}
