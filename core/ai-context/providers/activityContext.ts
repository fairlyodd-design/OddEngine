
export async function getActivityContext(){

 return [
  { type:"trade", message:"NVDA call opened" },
  { type:"plugin", message:"options-scanner loaded" }
 ]

}
