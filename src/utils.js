import fs from "node:fs/promises";
import Path from "node:path";

let _silent=false;
export const silent=(value)=>{
    if(typeof value === 'boolean'){
        _silent=value;
    }
    return _silent;
}

let _verbose=false;
export const verbose=(value)=>{
    if(typeof value === 'boolean'){
        _verbose=value;
    }
    return _verbose;
}



export const print=(...args)=>{
    if(!silent()){
        console.log(...args);
    }
}

/**
 * 
 * @param {string} path 
 * @returns 
 */
export const existsAsync=async (path)=>{
    try{
        await fs.access(path);
        return true;
    }catch{
        return false;
    }
}

/**
 * @param {string[]} paths 
 * @param {string} content 
 * @param {string|undefined} head 
 */
export const writeAryAsync=async (paths,content,head)=>{
    if(head){
        content=head+content;
    }
    print(`Write ${paths.join(', ')}`);
    await Promise.all(paths.map(async path=>{
        const dir=Path.dirname(path);
        if(dir && dir!=='.' && !await existsAsync(dir)){
             await fs.mkdir(dir,{recursive:true});
        }
        await fs.writeFile(path,content);
    }))
}

/**
 * @param {string} path 
 * @returns {Promise<string>}
 */
export const readStringAsync=async (path)=>{
    try{
        return (await fs.readFile(path)).toString();
    }catch(ex){
        const msg=`Unable to read file at path: ${path}`;
        console.error(msg,ex);
        throw new Error(msg);
    }
}

/**
 * @param {string} path 
 * @returns {Promise<any>}
 */
export const readJsonAsync=async (path)=>{
    const json=await readStringAsync(path);
    try{
        return JSON.parse(json);
    }catch(ex){
        const msg=`Unable to parse JSON contents of: ${path}`;
        console.error(msg,ex);
        throw new Error(msg);
    }
}

/**
 * @returns {Record<string,string|string[]>}
 */
export const parseArgs=()=>{
    const args={}

    for(let i=0;i<process.argv.length;i++){

        /** @type {string} */
        const arg=process.argv[i];
        if(!arg?.startsWith('--')){
            continue;
        }

        let value='true';
        let first=true;

        /** @type {string[]} */
        const allValues=[];
        for(let n=i+1;n<process.argv.length;n++){
            const next=process.argv[n];
            if(next.startsWith('--')){
                break;
            }
            if(first){
                first=false;
                value=next;
            }
            allValues.push(next);
        }

        const name=arg.substring(2).replace(/-(\w)/g,(_,c)=>c.toUpperCase());
        args[name]=value;
        args[name+'Ary']=allValues;
    }
    return args;
}

/**
 * @param {string} sql 
 * @param {number} statementStart 
 * @returns {string|undefined}
 */
export const findComment=(sql,statementStart)=>{
    let i=sql.lastIndexOf('\n',statementStart);
    if(i===-1){
        return undefined;
    }
    const lines=[];
    i--;
    while(i>-1){
        const s=sql.lastIndexOf('\n',i);
        if(s===-1){
            break;
        }
        const line=sql.substring(s,i+1).trim();
        if(line && !line.startsWith('--')){
            break;
        }
        lines.push(line.startsWith('-- ')?line.substring(3):line.substring(2));
        i=s-1;
    }
    while(lines[lines.length-1]===''){
        lines.pop();
    }
    return lines.length?lines.join('\n'):undefined;
}

export const escapeJsComment=(text)=>text.replace(/\*\//g,'(star)/');

export const toTsName=(name)=>(
    name.substring(0,1).toUpperCase()+
    name.substring(1).replace(/_+([a-z])/g,(_,c)=>c.toUpperCase())
);

export const toJsDoc=(text,indent,noEnclose)=>{
    const body=`${indent} * ${escapeJsComment(text).replace(/\n/g,()=>`\n${indent} * `)}`;
    return noEnclose?body:`${indent}/**\n${body}\n${indent} */`;

        
}
export const toConvoComment=(text,indent)=>{
    return `${indent}# ${text.replace(/\n/g,()=>`\n${indent}# `)}`;
}