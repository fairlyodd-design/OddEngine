
export function askCopilot(question:string){

 if(question.includes("best trade")){
   return "AI Suggestion: Watch NVDA momentum breakout."
 }

 if(question.includes("sector")){
   return "Semiconductors currently leading."
 }

 return "Copilot analyzing market conditions..."
}
