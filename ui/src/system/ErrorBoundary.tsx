
import React from "react"

type Props = { children:any }
type State = { hasError:boolean }

export default class ErrorBoundary extends React.Component<Props,State>{

 constructor(props:Props){
  super(props)
  this.state = { hasError:false }
 }

 static getDerivedStateFromError(){
  return { hasError:true }
 }

 componentDidCatch(err:any){
  console.error("Panel crash prevented:",err)
 }

 render(){

  if(this.state.hasError){

   return (
    <div style={{padding:20}}>
     <b>Panel crashed but OS is still running.</b>
    </div>
   )

  }

  return this.props.children

 }

}
