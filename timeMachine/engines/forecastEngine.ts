
export interface Forecast {
 sector:string
 direction:string
 probability:number
 horizon:string
}

export function getMarketForecast():Forecast[]{

 return [
  {sector:"TECH",direction:"WEAKENING",probability:0.63,horizon:"3-5 days"},
  {sector:"ENERGY",direction:"STRENGTHENING",probability:0.71,horizon:"3-5 days"},
  {sector:"MEDIA",direction:"SIDEWAYS",probability:0.52,horizon:"3-5 days"},
  {sector:"FINANCE",direction:"MILD_UPTREND",probability:0.58,horizon:"3-5 days"}
 ]

}
