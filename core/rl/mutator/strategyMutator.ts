
export function generateStrategyVariants(){

 const baseStrategies = [
  "momentum",
  "breakout",
  "mean_reversion"
 ]

 const variants:any[] = []

 baseStrategies.forEach(s=>{

   variants.push({
     name:s,
     params:{
       entryThreshold:Math.random(),
       exitThreshold:Math.random(),
       riskFactor:0.5+Math.random()*0.5
     }
   })

 })

 return variants

}
