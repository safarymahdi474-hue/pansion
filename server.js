const http=require("http"),fs=require("fs"),path=require("path");
const root=__dirname,port=Number(process.env.PORT||3000);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".ico":"image/x-icon"};
http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname)}catch{res.writeHead(400);return res.end("Bad request")}
let target=path.resolve(root,"."+pathname);if(!target.startsWith(root)){res.writeHead(403);return res.end("Forbidden")}
fs.stat(target,(err,st)=>{if(!err&&st.isDirectory())target=path.join(target,"index.html");fs.readFile(target,(e,data)=>{if(e){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found")}res.writeHead(200,{"Content-Type":types[path.extname(target)]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data)})})
}).listen(port,"0.0.0.0",()=>console.log("Pansion listening on "+port));
