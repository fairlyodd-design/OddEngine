
export interface FlowSignal {
 source:string
 target:string
 strength:number
}

export function getCapitalFlows():FlowSignal[] {

 return [
   {source:"TECH", target:"ENERGY", strength:0.7},
   {source:"MEDIA", target:"TECH", strength:0.4},
   {source:"INDEX", target:"TECH", strength:0.6}
 ]

}
