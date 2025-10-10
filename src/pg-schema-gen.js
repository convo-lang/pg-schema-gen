#!/usr/bin/env node
"use strict";

import { parse } from 'pgsql-ast-parser';
import { verbose, silent, writeAryAsync, print, parseArgs, readStringAsync, readJsonAsync, findComment, toJsDoc, toConvoComment, toTsName} from "./utils.js";

/**
 * @typedef Args
 * @prop {string[]|undefined} sqlAry Array of sql statements
 * @prop {string[]|undefined} sqlFileAry Array of sql files to load as statements
 * @prop {string[]|undefined} typeMapFileAry Array of type map json files
 * @prop {string|undefined} clearTypeMap Clears all default type mappings 
 * @prop {string|undefined} insertSuffix A suffix added to insert types
 * @prop {string|undefined} silent Silences console logging
 * @prop {string|undefined} verbose Enables verbose output
 * @prop {string[]|undefined} tsOutAry Array of paths to write TypeScript types to.
 * @prop {string[]|undefined} zodOutAry Array of paths to write Zod Schemas to
 * @prop {string[]|undefined} convoOutAry Array of paths to write Convo-Lang structs to
 * @prop {string[]|undefined} typeMapOutAry Array of paths to write the computed type map to
 * @prop {string[]|undefined} tableMapOutAry Array of paths to write the table map to as JSON
 * @prop {string[]|undefined} tsTableMapOutAry Array of paths to write the table map to as an exported JSON object
 * @prop {string[]|undefined} parsedSqlOutAry Array of paths to write parsed SQL to
 */

 /**
 * @typedef SrcType
 * @prop {string} name
 * @prop {string} baseName
 * @prop {boolean|undefined} insert
 * @prop {string[]} src
 */

 /**
 * @typedef TableMap
 * @prop {Record<string,string>} toTable
 * @prop {Record<string,string>} toName
 */

 /**
 * @typedef TypeMapping
 * @prop {string} _default
 * @prop {string|string} ts
 * @prop {string|string} zod
 * @prop {string|string} convo
 */

/** @type {Record<string,TypeMapping>} */
const defaultTypeMap={
    _default:{
        _default:'string',
    },
    text:{
        _default:'string',
    },
    int:{
        _default:'number',
        zod:'number().int()',
    },
    int2:{
        _default:'number',
        zod:'number().int()',
    },
    int4:{
        _default:'',
        zod:'number().int()',
    },
    int8:{
        _default:'',
        zod:'number().int()',
    },
    float:{
        _default:'number',
    },
    float4:{
        _default:'number',
    },
    float8:{
        _default:'number',
    },
    numeric:{
        _default:'number',
    },
    json:{
        _default:'json',
        ts:'Record<string,any>',
        zod:'record(z.string(),z.any())',
        convo:'map',
    },
    jsonb:{
        _default:'json',
        ts:'Record<string,any>',
        zod:'record(z.string(),z.any())',
        convo:'map',
    },
    bool:{
        _default:'boolean',
    },
}

let indent='    ';

const main=async ()=>{
    /** @type {Args} */
    const args=parseArgs();

    if(args.verbose==='true'){
        verbose(true);
    }
    if(verbose()){
        print('Arguments',args);
    }
    if(args.silent==='true'){
        silent(true);
    }

    const insertSuffix=args.insertSuffix??'Insertion';

    let typeMap=args.clearTypeMap==='true'?{}:{...defaultTypeMap};
    if(args.typeMapFileAry){
        for(const path of args.typeMapFileAry){
            const map=await readJsonAsync(path);
            if(!map || (typeof map !== 'object')){
                throw new Error('type map file should contain a JSON object');
            }
            for(const type in map){
                typeMap[type]={
                    ...typeMap[type],
                    ...map[type],
                }
            }
        }
    }

    /** @type {string[]} */
    const sqlAry=[];

    if(args.sqlAry){
        sqlAry.push(...args.sqlAry);
    }

    if(args.sqlFileAry){
        for(const path of args.sqlFileAry){
            print(`Load ${path}`);

            const sqlStatements=await readStringAsync(path);

            sqlAry.push(sqlStatements);
        }
    }

    const sql=sqlAry.join('\n\n');
    const statements=parse(sql,{locationTracking:true});

    if(args.parsedSqlOutAry){
        print('Write parsed SQL')
        await writeAryAsync(args.parsedSqlOutAry,JSON.stringify(statements,null,4));
    }

    /** @type {SrcType[]} */
    const tsTypes=[];

    /** @type {SrcType[]} */
    const zodTypes=[];

    /** @type {SrcType[]} */
    const convoTypes=[];

    /** @type {TableMap} */
    const tableMap={
        toName:{},
        toTable:{},
    }

    for(const s of statements){
        switch(s.type){

            case 'create table':
                createType(s,false,insertSuffix,sql,typeMap,tableMap,tsTypes,zodTypes,convoTypes);
                createType(s,true,insertSuffix,sql,typeMap,tableMap,tsTypes,zodTypes,convoTypes);
                break;
            

        }
    }

    await Promise.all([
        args.tsOutAry?writeAryAsync(args.tsOutAry,typesToString(tsTypes)):null,
        args.zodOutAry?writeAryAsync(args.zodOutAry,typesToString(zodTypes),`import { z } from "zod";\n\n`):null,
        args.convoOutAry?writeAryAsync(args.convoOutAry,typesToString(convoTypes),'> define\n\n'):null,
        args.typeMapOutAry?writeAryAsync(args.typeMapOutAry,JSON.stringify(typeMap,null,4)):null,
        args.tableMapOutAry?writeAryAsync(args.tableMapOutAry,JSON.stringify(tableMap,null,4)):null,
        args.tsTableMapOutAry?writeAryAsync(args.tsTableMapOutAry,JSON.stringify(tableMap,null,4),`export const tableMap=`):null,
    ]);

}

/**
 * @param {import('pgsql-ast-parser').CreateTableStatement} s
 * @param {boolean} forInsert
 * @param {string} insertSuffix
 * @param {string} sql
 * @param {Record<string,TypeMapping>} typeMap
 * @param {TableMap} tableMap
 * @param {SrcType[]} tsTypes
 * @param {SrcType[]} zodTypes
 * @param {SrcType[]} convoTypes
 */
const createType=(s,forInsert,insertSuffix,sql,typeMap,tableMap,tsTypes,zodTypes,convoTypes)=>{
    const baseName=toTsName(s.name.name);
    const name=baseName+(forInsert?insertSuffix:'');
    if(!forInsert){
        tableMap.toName[s.name.name]=name;
    }
    tableMap.toTable[name]=s.name.name;

    /** @type {SrcType} */
    const tsType={name,baseName,src:[]};
    /** @type {SrcType} */
    const zodType={name,baseName,src:[]};
    /** @type {SrcType} */
    const convoType={name,baseName,src:[]};

    const typeDescription=s._location && !forInsert?findComment(sql,s._location.start):undefined;

    tsType.src.push(`/**\n`);
    if(typeDescription){
        tsType.src.push(`${toJsDoc(typeDescription,'',true)}\n`);
    }
    if(forInsert){
        tsType.src.push(` * @insertFor ${baseName}\n`);
    }
    tsType.src.push(` * @table ${s.name.name}\n`);
    if(s.name.schema){
        tsType.src.push(` * @schema ${s.name.schema}\n`)
    }
    tsType.src.push(' */\n');
    zodType.src.push(...tsType.src);
    zodType.src.splice(1,typeDescription?1:0,` * Zod schema for the "${name}" interface\n`);
    tsType.src.push(`export interface ${name}\n{\n`);
    zodType.src.push(`export const ${name}Schema=z.object({\n`);
    convoType.src.push(`${name} = struct(\n`);


    for(const c of s.columns??[]){
        if(c.kind!=='column'){
            continue;
        }
        const prop=c.name.name;
        let arrayDepth=0;
        let dataType=c.dataType;
        const notNull=c.constraints.some(c=>c.type==='not null');
        const isPrimary=c.constraints.some(c=>c.type==='primary key');
        const hasDefault=c.constraints.some(c=>c.type==='default');
        const required=forInsert?((notNull || isPrimary) && !hasDefault):(notNull || isPrimary);
        const optional=!required;
        while(dataType.kind==='array'){
            arrayDepth++;
            dataType=dataType.arrayOf
        }
        
        /** @type {import('pgsql-ast-parser').BasicDataTypeDef} */
        const sqlType=dataType;
        const sqlTypeLower=sqlType.name.toLowerCase();
        const mt=typeMap[sqlTypeLower]??typeMap['_default']??{_default:'string'};

        const description=c._location && !forInsert?findComment(sql,c._location.start):undefined;

        if(description){
            tsType.src.push(`${toJsDoc(description,indent)}\n`);
            convoType.src.push(`${toConvoComment(description,indent)}\n`);
        }

        tsType.src.push(`${indent}${prop}${optional?'?':''}:${mt.ts??mt._default}${'[]'.repeat(arrayDepth)};\n`);

        let convoProp=`${indent}${prop}${optional?'?':''}:${mt.convo??mt._default}`;
        for(let a=0;a<arrayDepth;a++){
            convoProp=`array(${convoProp})`
        }
        convoType.src.push(convoProp+'\n');

        let zodProp=mt.zod??mt._default;
        if(!zodProp.includes('(')){
            zodProp+='()';
        }
        if(optional){
            zodProp+='.optional()';
        }
        if(arrayDepth){
            zodProp+='.array()'.repeat(arrayDepth);
        }
        if(description){
            zodProp+=`.describe(${JSON.stringify(description)})`;
        }
        zodType.src.push(`${indent}${prop}:z.${zodProp},\n`);
    }


    tsType.src.push('}');
    zodType.src.push(`})${typeDescription?`.describe(${JSON.stringify(typeDescription)})`:''};`);
    convoType.src.push(')')

    tsTypes.push(tsType);
    zodTypes.push(zodType);
    convoTypes.push(convoType);
}
/**
 * @param {SrcType[]} types
 * @returns {string}
 */
const typesToString=(types)=>{
    types.sort((a,b)=>a.baseName.localeCompare(b.baseName));
    return types.map(t=>t.src.join('')).join('\n\n');
}

main();