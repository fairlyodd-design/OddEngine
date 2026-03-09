
import { getCommands } from "./commandRegistry"

export function runCommand(id:string){

 const cmds = getCommands()
 const cmd = cmds.find(c=>c.id===id)

 if(!cmd) return

 console.log("Running command:",id)

 cmd.action()

}
