
export async function pushState(state:any){
 console.log("Sync push",state)
}

export async function pullState(){
 console.log("Sync pull")
 return {}
}
