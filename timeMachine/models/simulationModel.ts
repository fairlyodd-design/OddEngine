
export interface SimulationState{
 timestamp:number
 description:string
 confidence:number
}

export function generateSimulation(){

 return {
  timestamp:Date.now(),
  description:"Energy sector leadership forming",
  confidence:0.72
 }

}
