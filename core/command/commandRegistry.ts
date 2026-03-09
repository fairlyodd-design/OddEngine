
type Command = {
  id:string
  title:string
  action:()=>void
}

const commands:Command[] = []

export function registerCommand(cmd:Command){
  commands.push(cmd)
}

export function getCommands(){
  return commands
}
