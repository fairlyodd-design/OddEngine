
export function getSectorStrength(){

 return [
  {sector:"TECH", strength:(Math.random()*100).toFixed(1)},
  {sector:"ENERGY", strength:(Math.random()*100).toFixed(1)},
  {sector:"MEDIA", strength:(Math.random()*100).toFixed(1)},
  {sector:"FINANCE", strength:(Math.random()*100).toFixed(1)}
 ]

}
