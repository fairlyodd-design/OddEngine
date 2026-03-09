
export function detectMarketRegime(vix:number, spyTrend:number){

 if(vix > 25) return "HIGH_VOL"

 if(spyTrend > 0.7) return "TRENDING"

 if(spyTrend < -0.5) return "BEARISH"

 return "CHOPPY"

}
