
export function detectRegime(vix:number, trend:number){

 if(vix>25) return "VOLATILE"
 if(trend>0.5) return "BULLISH"
 if(trend<-0.5) return "BEARISH"
 return "SIDEWAYS"

}
