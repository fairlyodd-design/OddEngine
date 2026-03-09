
import { predictMove } from "./models/neuralModel"
import { getTradeIdeas } from "../trade-engine/tradeEngine"

let predictions:any[] = []

export function runNeuralInference(){

 const ideas = getTradeIdeas()

 predictions = ideas.map((idea:any)=>{

   const p = predictMove(idea)

   return {
     ticker: idea.ticker,
     setup: idea.setup,
     probability: p.probability,
     expectedMove: p.expectedMove,
     confidence: p.confidence
   }

 })

}

export function getPredictions(){
 return predictions
}
