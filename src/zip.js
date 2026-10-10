/** ZIP reader for local benchmark packages. Central-directory ZIP32 only, with strict bounds. */
const MAX_ARCHIVE=12*1024*1024, MAX_FILE=4*1024*1024, MAX_TOTAL=16*1024*1024, MAX_ENTRIES=300;
const decoder=new TextDecoder('utf-8',{fatal:true});
const nameDecoder=new TextDecoder('utf-8',{fatal:false});
const u16=(v,o)=>v.getUint16(o,true),u32=(v,o)=>v.getUint32(o,true);
function requireRange(view,start,length){if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||start<0||length<0||start+length>view.byteLength)throw Error('Invalid ZIP structure or truncated entry')}
function safeName(name){return name && !name.startsWith('/') && !name.includes('\\') && !name.includes('\0') && !name.split('/').some(s=>s==='..'||s==='.') && !/^[a-zA-Z]:/.test(name)}
async function inflate(bytes){
 if(typeof DecompressionStream==='undefined')throw Error('Your browser does not support local ZIP decompression. Try an updated Chrome, Edge or Safari.');
 let stream;try{stream=new DecompressionStream('deflate-raw')}catch{throw Error('Your browser does not support deflate-raw ZIP entries. Try a modern desktop browser.')}
 const decompressed=new Blob([bytes]).stream().pipeThrough(stream);
 const reader=decompressed.getReader();let total=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_FILE){await reader.cancel().catch(()=>{});throw Error('Decompressed file exceeds 4 MB limit')}chunks.push(value)}}finally{reader.releaseLock()}
 const output=new Uint8Array(total);let off=0;for(const c of chunks){output.set(c,off);off+=c.length}return output;
}
export async function unzipTask(input){
 const buffer=input instanceof ArrayBuffer?input:input instanceof Uint8Array?input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength):await input.arrayBuffer();
 if(buffer.byteLength>MAX_ARCHIVE)throw Error('ZIP exceeds 12 MB upload limit');
 const view=new DataView(buffer);let eocd=-1;
 for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--){if(u32(view,i)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw Error('Not a valid ZIP archive (missing central directory)');
 requireRange(view,eocd,22);
 if(u16(view,eocd+4)||u16(view,eocd+6))throw Error('Multi-disk ZIP archives are unsupported');
 const count=u16(view,eocd+10),directorySize=u32(view,eocd+12),directoryOffset=u32(view,eocd+16);
 if(count>MAX_ENTRIES)throw Error(`ZIP contains too many entries (max ${MAX_ENTRIES})`);
 if(directorySize===0xffffffff||directoryOffset===0xffffffff)throw Error('ZIP64 archives are unsupported');
 requireRange(view,directoryOffset,directorySize);
 let cursor=directoryOffset,total=0;const files={};
 for(let i=0;i<count;i++){
   requireRange(view,cursor,46);if(u32(view,cursor)!==0x02014b50)throw Error('Invalid ZIP central directory entry');
   const flags=u16(view,cursor+8),method=u16(view,cursor+10),crc=u32(view,cursor+16),compressed=u32(view,cursor+20),size=u32(view,cursor+24);
   const nameLen=u16(view,cursor+28),extraLen=u16(view,cursor+30),commentLen=u16(view,cursor+32),externalAttr=u32(view,cursor+38),offset=u32(view,cursor+42);
   requireRange(view,cursor+46,nameLen+extraLen+commentLen);
   const name=nameDecoder.decode(new Uint8Array(buffer,cursor+46,nameLen));cursor+=46+nameLen+extraLen+commentLen;
   if(!safeName(name))throw Error(`Unsafe archive entry path: ${name}`);
   if(name.endsWith('/'))continue;
   const mode=(externalAttr>>>16)&0xf000;if(mode===0xa000)throw Error('ZIP symbolic links are unsupported');
   if(flags&1)throw Error('Encrypted ZIP entries are unsupported');
   if(method!==0&&method!==8)throw Error(`Unsupported ZIP compression for ${name}`);
   if(Object.hasOwn(files,name))throw Error(`Duplicate ZIP path: ${name}`);
   if(size>MAX_FILE)throw Error(`Entry ${name} exceeds 4 MB limit`);
   total+=size;if(total>MAX_TOTAL)throw Error('ZIP expands beyond 16 MB limit');
   requireRange(view,offset,30);if(u32(view,offset)!==0x04034b50)throw Error('Invalid ZIP local file header');
   const dataOffset=offset+30+u16(view,offset+26)+u16(view,offset+28);requireRange(view,dataOffset,compressed);
   const chunk=new Uint8Array(buffer,dataOffset,compressed);
   let out=method===0?new Uint8Array(chunk):await inflate(chunk);
   if(out.byteLength!==size)throw Error(`ZIP entry length mismatch: ${name}`);
   if(crc32(out)!==crc)throw Error(`ZIP checksum mismatch: ${name}`);
   try{files[name]=decoder.decode(out)}catch{throw Error(`Non-UTF-8 content in ${name}. Benchmark text files must be UTF-8.`)}
 }
 return files;
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
