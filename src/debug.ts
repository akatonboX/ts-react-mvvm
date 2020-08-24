function nolog(...items: any[]): void {}
export const debug = {
  log: process.env.NODE_ENV === "development" ? console.log.bind(console, "%c[log]", "color:blue;font-weight:bold;") : nolog,
  error: process.env.NODE_ENV === "development" ? console.log.bind(console, "%c[error]", "color:red;font-weight:bold;") : nolog,
}