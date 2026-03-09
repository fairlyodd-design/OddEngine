
export function predictMove(signal:any){

 const probability = 0.5 + Math.random()*0.4
 const expectedMove = (Math.random()*4).toFixed(2)
 const confidence = probability * (0.8 + Math.random()*0.2)

 return {
   probability,
   expectedMove,
   confidence
 }

}
