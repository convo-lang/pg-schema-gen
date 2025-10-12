#!/usr/bin/env node
"use strict";

import { parse } from 'pgsql-ast-parser';
import { verbose, silent, writeAryAsync, print, parseArgs, readStringAsync, readJsonAsync, findComment, toJsDoc, toConvoComment, toTsName} from "./utils.js";
import Path from "node:path";

/**
 * @typedef Args
 * @prop {string[]|undefined} sqlAry Array of sql statements
 * @prop {string[]|undefined} sqlFileAry Array of sql files to load as statements
 * @prop {string[]|undefined} typeMapFileAry Array of type map json files
 * @prop {string|undefined} clearTypeMap Clears all default type mappings 
 * @prop {string|undefined} insertSuffix A suffix added to insert types
 * @prop {string|undefined} silent Silences console logging
 * @prop {string|undefined} verbose Enables verbose output
 * @prop {string[]|undefined} outAry Array of directory paths to schema file to.
 * @prop {string[]|undefined} tsOutAry Array of paths to write TypeScript types to.
 * @prop {string[]|undefined} zodOutAry Array of paths to write Zod Schemas to
 * @prop {string[]|undefined} convoOutAry Array of paths to write Convo-Lang structs to
 * @prop {string[]|undefined} typeMapOutAry Array of paths to write the computed type map to
 * @prop {string[]|undefined} tableMapOutAry Array of paths to write the table map to as JSON
 * @prop {string[]|undefined} tsTableMapOutAry Array of paths to write the table map to as an exported JSON object
 * @prop {string[]|undefined} typeListOutAry Array of paths to write the type list as a JSON array to.
 * @prop {string[]|undefined} typeListShortOutAry Array of paths to write the shortened type list as a JSON array to.
 *                                                Type props are written as an array of strings
 * @prop {string[]|undefined} parsedSqlOutAry Array of paths to write parsed SQL to
 */

 /**
  * @typedef SrcType
  * @prop {string} name
  * @prop {string} baseName
  * @prop {string|undefined} description
  * @prop {boolean|undefined} insert
  * @prop {string[]} src
  * @prop {'type'|'enum'} type
  * @prop {number} order
  * @prop {SrcProp[]} props
  */

 /**
  * @typedef TypeDef
  * @prop {string} name
  * @prop {string|undefined} description
  * @prop {'type'|'enum'} type
  * @prop {string|undefined} sqlTable
  * @prop {string|undefined} sqlSchema
  * @prop {PropDef[]|undefined} props
  */

 /**
  * @typedef PropDef
  * @prop {string} name
  * @prop {TypeMapping} type
  * @prop {string|undefined} description
  * @prop {string|undefined} sqlDef
  * @prop {boolean|undefined} optional
  * @prop {boolean|undefined} hasDefault
  * @prop {boolean|undefined} isArray
  * @prop {number|undefined} arrayDimensions
  */

 /**
  * @typedef TableMap
  * @prop {Record<string,string>} toTable
  * @prop {Record<string,string>} toName
  */

 /**
  * @typedef TypeMapping
  * @prop {string} name
  * @prop {string|undefined} ts
  * @prop {string|undefined} zod
  * @prop {string|undefined} convo
  * @prop {string|undefined} sql
  */

/** @type {Record<string,TypeMapping>} */
const defaultTypeMap={
    _default:{
        name:'string',
    },
    text:{
        name:'string',
    },
    int:{
        name:'number',
        zod:'z.number().int()',
    },
    int2:{
        name:'number',
        zod:'z.number().int()',
    },
    int4:{
        name:'',
        zod:'z.number().int()',
    },
    int8:{
        name:'',
        zod:'z.number().int()',
    },
    float:{
        name:'number',
    },
    float4:{
        name:'number',
    },
    float8:{
        name:'number',
    },
    numeric:{
        name:'number',
    },
    json:{
        name:'json',
        ts:'Record<string,any>',
        zod:'z.record(z.string(),z.any())',
        convo:'map',
    },
    jsonb:{
        name:'json',
        ts:'Record<string,any>',
        zod:'z.record(z.string(),z.any())',
        convo:'map',
    },
    bool:{
        name:'boolean',
    },
}

let indent='    ';

const main=async ()=>{
    /** @type {Args} */
    const args=parseArgs();

    if(args.outAry?.length){
        if(!args.tsOutAry?.length){
            args.tsOutAry=args.outAry.map(p=>Path.join(p,'types-ts.ts'));
        }
        if(!args.zodOutAry?.length){
            args.zodOutAry=args.outAry.map(p=>Path.join(p,'types-zod.ts'));
        }
        if(!args.convoOutAry?.length){
            args.convoOutAry=args.outAry.map(p=>Path.join(p,'types-convo.convo'));
        }
        if(!args.typeMapOutAry?.length){
            args.typeMapOutAry=args.outAry.map(p=>Path.join(p,'type-map.json'));
        }
        if(!args.tableMapOutAry?.length){
            args.tableMapOutAry=args.outAry.map(p=>Path.join(p,'type-table-map.json'));
        }
        if(!args.tsTableMapOutAry?.length){
            args.tsTableMapOutAry=args.outAry.map(p=>Path.join(p,'type-table-map-ts.ts'));
        }
        if(!args.typeListOutAry?.length){
            args.typeListOutAry=args.outAry.map(p=>Path.join(p,'type-list.json'));
        }
        if(!args.typeListShortOutAry?.length){
            args.typeListShortOutAry=args.outAry.map(p=>Path.join(p,'type-list-short.json'));
        }
        if(!args.parsedSqlOutAry?.length){
            args.parsedSqlOutAry=args.outAry.map(p=>Path.join(p,'type-sql-src.json'));
        }
    }

    if(args.verbose==='true'){
        verbose(true);
    }
    if(verbose()){
        print('Arguments',args);
    }
    if(args.silent==='true'){
        silent(true);
    }

    const insertSuffix=args.insertSuffix??'_insert';

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

    const sql=sqlAry.join('\n\n').replace(/TABLESPACE\s+\w+/gi,'');
    const statements=parse(sql,{locationTracking:true});

    if(args.parsedSqlOutAry){
        print('Write parsed SQL');
        await writeAryAsync(args.parsedSqlOutAry,JSON.stringify(statements,null,4));
    }

    /** @type {TypeDef[]} */
    const typeDefs=[];

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

    // Search for enums first
    for(const s of statements){
        switch(s.type){

            case 'create enum':
                createEnum(s,sql,typeMap,typeDefs,tsTypes,zodTypes,convoTypes);
                break;
            

        }
    }

    for(const s of statements){
        switch(s.type){

            case 'create table':
                createType(s,false,insertSuffix,sql,typeMap,tableMap,typeDefs,tsTypes,zodTypes,convoTypes);
                createType(s,true,insertSuffix,sql,typeMap,tableMap,typeDefs,tsTypes,zodTypes,convoTypes);
                break;
            

        }
    }

    typeDefs.sort((a,b)=>a.name.localeCompare(b.name));

    await Promise.all([
        args.tsOutAry?writeAryAsync(args.tsOutAry,typesToString(tsTypes)):null,
        args.typeListOutAry?writeAryAsync(args.typeListOutAry,JSON.stringify(typeDefs,null,4)):null,
        args.typeListShortOutAry?writeAryAsync(args.typeListShortOutAry,JSON.stringify(typeDefs.map(t=>({
            ...t,
            props:t.props?.map(p=>p.name)
        })),null,4)):null,
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
 * @param {TypeDef[]} typeDefs
 * @param {SrcType[]} tsTypes
 * @param {SrcType[]} zodTypes
 * @param {SrcType[]} convoTypes
 */
const createType=(
    s,
    forInsert,
    insertSuffix,
    sql,
    typeMap,
    tableMap,
    typeDefs,
    tsTypes,
    zodTypes,
    convoTypes
)=>{
    const baseName=toTsName(s.name.name);
    const name=baseName+(forInsert?insertSuffix:'');
    if(!forInsert){
        tableMap.toName[s.name.name]=name;
    }
    tableMap.toTable[name]=s.name.name;

    const typeDescription=s._location && !forInsert?findComment(sql,s._location.start):undefined;

    /** @type {TypeDef} */
    const typeDef={
        name,
        type:'type',
        description:typeDescription,
        sqlTable:s.name.name,
        sqlSchema:s.name.schema,
        props:[],
    };

    /** @type {SrcType} */
    const tsType={name,baseName,src:[],type:'type',order:2};
    /** @type {SrcType} */
    const zodType={name,baseName,src:[],type:'type',order:2};
    /** @type {SrcType} */
    const convoType={name,baseName,src:[],type:'type',order:2};


    tsType.src.push(`/**\n`);
    if(typeDescription){
        tsType.src.push(`${toJsDoc(typeDescription,'',true)}\n`);
        convoType.src.push(`${toConvoComment(typeDescription,'')}\n`);
    }
    if(forInsert){
        tsType.src.push(` * @insertFor ${baseName}\n`);
        convoType.src.push(`# insertFor: ${baseName}\n`);
    }
    tsType.src.push(` * @table ${s.name.name}\n`);
    convoType.src.push(`# table: ${s.name.name}\n`);
    if(s.name.schema){
        tsType.src.push(` * @schema ${s.name.schema}\n`);
        convoType.src.push(`# schema: ${s.name.schema}\n`);
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
        const notNull=c.constraints?.some(c=>c.type==='not null');
        const isPrimary=c.constraints?.some(c=>c.type==='primary key');
        const hasDefault=c.constraints?.some(c=>c.type==='default');
        const required=forInsert?((notNull || isPrimary) && !hasDefault):(notNull || isPrimary);
        const optional=!required;
        while(dataType.kind==='array'){
            arrayDepth++;
            dataType=dataType.arrayOf
        }
        
        /** @type {import('pgsql-ast-parser').BasicDataTypeDef} */
        const sqlType=dataType;
        const sqlTypeLower=sqlType.name.toLowerCase();
        const mt=typeMap[sqlTypeLower]??typeMap['_default']??{name:'string'};

        const description=c._location && !forInsert?findComment(sql,c._location.start):undefined;

        if(description){
            tsType.src.push(`${toJsDoc(description,indent)}\n`);
            convoType.src.push(`${toConvoComment(description,indent)}\n`);
        }

        tsType.src.push(`${indent}${prop}${optional?'?':''}:${mt.ts??mt.name}${'[]'.repeat(arrayDepth)};\n`);

        let convoProp=`${indent}${prop}${optional?'?':''}: ${mt.convo??mt.name}`;
        for(let a=0;a<arrayDepth;a++){
            convoProp=`array(${convoProp})`
        }
        convoType.src.push(convoProp+'\n');

        let zodProp=mt.zod??'z.'+mt.name+'()';
        if(optional){
            zodProp+='.optional()';
        }
        if(arrayDepth){
            zodProp+='.array()'.repeat(arrayDepth);
        }
        if(description){
            zodProp+=`.describe(${JSON.stringify(description)})`;
        }
        zodType.src.push(`${indent}${prop}:${zodProp},\n`);

        typeDef.props.push({
            name:prop,
            type:{
                ...mt,
                ts:mt.ts??mt.name,
                sql:sqlType.name,
            },
            description:description||undefined,
            sqlDef:c._location?sql.substring(c._location.start,c._location.end):undefined,
            optional:optional||undefined,
            hasDefault:hasDefault||undefined,
            isArray:arrayDepth?true:undefined,
            arrayDimensions:arrayDepth||undefined,

        })
    }


    tsType.src.push('}');
    zodType.src.push(`})${typeDescription?`.describe(${JSON.stringify(typeDescription)})`:''};`);
    convoType.src.push(')')

    tsTypes.push(tsType);
    zodTypes.push(zodType);
    convoTypes.push(convoType);

    if(!forInsert){
        typeDefs.push(typeDef);
    }
}
/**
 * @param {SrcType[]} types
 * @returns {string}
 */
const typesToString=(types)=>{
    types.sort((a,b)=>srcTypeOrderName(a).localeCompare(srcTypeOrderName(b)));
    return types.map(t=>t.src.join('')).join('\n\n');
}

/**
 * @param {SrcType} type
 */
const srcTypeOrderName=(type)=>`${type.order.toString().padStart(3,'0')}_${type.baseName}`;

/**
 * @param {import('pgsql-ast-parser').CreateEnumType} s
 * @param {string} sql
 * @param {Record<string,TypeMapping>} typeMap
 * @param {TypeDef[]} typeDefs
 * @param {SrcType[]} tsTypes
 * @param {SrcType[]} zodTypes
 * @param {SrcType[]} convoTypes
 */
const createEnum=(
    s,
    sql,
    typeMap,
    typeDefs,
    tsTypes,
    zodTypes,
    convoTypes
)=>{
    const sqlName=s.name.name;
    const name=toTsName(sqlName);

    typeMap[sqlName]={
        name:name,
        zod:`${name}Schema`
    };

    const typeDescription=s._location?findComment(sql,s._location.start):undefined;

    /** @type {TypeDef} */
    const typeDef={name,type:'type',description:typeDescription};
    /** @type {SrcType} */
    const tsType={name,baseName:name,src:[],type:'enum',order:1};
    /** @type {SrcType} */
    const zodType={name,baseName:name,src:[],type:'enum',order:1};
    /** @type {SrcType} */
    const convoType={name,baseName:name,src:[],type:'enum',order:1};


    if(typeDescription){
        tsType.src.push(`/**\n`);
        tsType.src.push(`${toJsDoc(typeDescription,'',true)}\n`);
        tsType.src.push(' */\n');

        convoType.src.push(`${toConvoComment(typeDescription,'')}\n`);
    }
    zodType.src.push(`/**\n`);
    if(typeDescription){
        zodType.src.push(`${toJsDoc(typeDescription,'',true)}\n`);
    }
    zodType.src.push(` * Zod schema for the "${name}" union\n`);
    zodType.src.push(' */\n');
    
    tsType.src.push(`export type ${name}=`);
    zodType.src.push(`export const ${name}Schema=z.enum([`);
    convoType.src.push(`${name} = enum(`);


    const values=[];
    for(const c of s.values){
        if(typeof c.value !== 'string'){
            continue;
        }

        values.push(JSON.stringify(c.value));
    }

    tsType.src.push(values.join('|'));
    zodType.src.push(values.join(','));
    convoType.src.push(values.join(' '));


    tsType.src.push(';');
    zodType.src.push(`])${typeDescription?`.describe(${JSON.stringify(typeDescription)})`:''};`);
    convoType.src.push(')')

    tsTypes.push(tsType);
    zodTypes.push(zodType);
    convoTypes.push(convoType);
    typeDefs.push(typeDef);
}

main();