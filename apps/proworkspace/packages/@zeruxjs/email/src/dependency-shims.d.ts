declare module 'nodemailer' {
  const client:{createTransport(options:Record<string,unknown>):{sendMail(message:Record<string,unknown>):Promise<{messageId?:string;accepted?:unknown[];rejected?:unknown[];response?:string}>;verify():Promise<boolean>;close():void}};
  export default client;
}
declare module 'juice' {const juice:(html:string,options?:Record<string,unknown>)=>string;export default juice;}
declare module 'sanitize-html' {const sanitize:(html:string,options?:Record<string,unknown>)=>string;export default sanitize;}
declare module 'html-to-text' {export function convert(html:string,options?:Record<string,unknown>):string;}
