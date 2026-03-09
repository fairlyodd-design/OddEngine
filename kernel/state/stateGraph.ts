
const state:any = {
 market:{},
 strategies:{},
 portfolio:{},
 signals:{}
}

export function getState(){
 return state
}

export function updateState(path:string,value:any){

 const parts = path.split(".")
 let obj = state

 for(let i=0;i<parts.length-1;i++){
   obj = obj[parts[i]]
 }

 obj[parts[parts.length-1]] = value

}
