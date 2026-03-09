
type CommandHandler = (input:string)=>string

const commands:Record<string,CommandHandler> = {}

export function registerCommand(name:string,handler:CommandHandler){
 commands[name] = handler
}

export function runCommand(input:string){
 const parts = input.split(" ")
 const cmd = parts[0]

 if(commands[cmd]){
   return commands[cmd](input)
 }

 return "Unknown command"
}
