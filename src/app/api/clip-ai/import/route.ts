import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function config(){const base=process.env.CLIP_WORKER_URL?.trim().replace(/\/+$/,"");const token=process.env.CLIP_WORKER_TOKEN?.trim();return base&&token?{base,token}:null;}
function message(p:any,f:string){return typeof p?.detail==="string"?p.detail:typeof p?.message==="string"?p.message:f;}
export async function POST(request:Request){
 let body:any;try{body=await request.json();}catch{return NextResponse.json({error:"Paste a valid video URL."},{status:400});}
 const raw=typeof body?.url==="string"?body.url.trim():"";if(!raw||raw.length>2048)return NextResponse.json({error:"Paste a valid video URL (maximum 2,048 characters)."},{status:400});
 let url:URL;try{url=new URL(raw);}catch{return NextResponse.json({error:"That URL is not valid. Include https://."},{status:400});}
 if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return NextResponse.json({error:"Use a public http:// or https:// video link without embedded credentials."},{status:400});
 const c=config();if(!c)return NextResponse.json({error:"The free Clip AI engine is implemented, but its worker is not connected yet. Deploy the open-source service in clip-worker, then set CLIP_WORKER_URL and CLIP_WORKER_TOKEN as server-side environment variables.",setupRequired:true},{status:503});
 try{const r=await fetch(c.base+"/jobs",{method:"POST",headers:{Authorization:"Bearer "+c.token,"Content-Type":"application/json"},body:JSON.stringify({url:url.toString()}),cache:"no-store",signal:AbortSignal.timeout(15000)});const p=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:message(p,"The free worker rejected this video link.")},{status:r.status});return NextResponse.json({projectId:String(p.jobId||""),provider:"Open-source worker",message:p.message||"Video queued for local transcription and rendering."},{status:202});}
 catch(e){return NextResponse.json({error:e instanceof Error&&e.name==="TimeoutError"?"The worker took too long to accept the job. Check that it is online, then retry.":"Could not reach the free Clip AI worker. Check CLIP_WORKER_URL and worker logs."},{status:502});}
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get("projectId")?.trim();if(!id||!/^[a-f0-9]{32}$/.test(id))return NextResponse.json({error:"A valid job ID is required."},{status:400});
 const c=config();if(!c)return NextResponse.json({error:"The free Clip AI worker is not connected. Configure CLIP_WORKER_URL and CLIP_WORKER_TOKEN."},{status:503});
 try{const r=await fetch(c.base+"/jobs/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+c.token},cache:"no-store",signal:AbortSignal.timeout(15000)});const p=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:message(p,"Could not retrieve this job.")},{status:r.status});
 const clips=Array.isArray(p.clips)?p.clips.map((x:any)=>({id:String(x.id||""),title:String(x.title||"Generated clip"),hook:String(x.hook||""),start:Number(x.start||0),end:Number(x.end||0),url:typeof x.url==="string"&&x.url.startsWith("/")?c.base+x.url:String(x.url||"")})).filter((x:{url:string})=>/^https?:\/\//i.test(x.url)):[];
 return NextResponse.json({status:p.status,clips,message:p.message||"Worker status updated.",error:p.status==="failed"?p.message:undefined});
 }catch{return NextResponse.json({error:"Could not reach the free Clip AI worker to check job status."},{status:502});}
}