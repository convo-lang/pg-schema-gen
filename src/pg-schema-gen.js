#!/usr/bin/env node
// @ts-check
"use strict";

import { parse } from 'pgsql-parser';
import { verbose, silent, writeAryAsync, print, parseArgs, readStringAsync, readJsonAsync, findComment, toJsDoc, toConvoComment, toTsName, removeSqlComments, removeTrailingComma} from "./utils.js";
import Path from "node:path";
import { getPgColumnDef, getPgConstraint, getPgConstraints, getPgCreateEnum, getPgCreateTable, getPgStrings, getPgTypeName } from './pg-types.js';

/**
 * @import * as Pg from "./pg-types.js"
 */

/**
 * @typedef Args
 * @prop {string[]=} sqlAry Array of sql statements
 * @prop {string[]=} sqlFileAry Array of sql files to load as statements
 * @prop {string[]=} typeMapFileAry Array of type map json files
 * @prop {string=} clearTypeMap Clears all default type mappings 
 * @prop {string=} insertSuffix A suffix added to insert types
 * @prop {string=} silent Silences console logging
 * @prop {string=} verbose Enables verbose output
 * @prop {string=} barrelBase Base path to import exported exports from in the schema barrel
 * @prop {string=} disableSchemaBarrel Disables the default schema barrel
 * @prop {string=} importExt Sets the import extension used with TypeScript files
 * @prop {string[]=} outAry Array of directory paths to schema file to.
 * @prop {string[]=} tsOutAry Array of paths to write TypeScript types to.
 * @prop {string[]=} zodOutAry Array of paths to write Zod Schemas to
 * @prop {string[]=} convoOutAry Array of paths to write Convo-Lang structs to
 * @prop {string[]=} typeMapOutAry Array of paths to write the computed type map to
 * @prop {string[]=} tableMapOutAry Array of paths to write the table map to as JSON
 * @prop {string[]=} tsTableMapOutAry Array of paths to write the table map to as an exported JSON object
 * @prop {string[]=} tsTypeDefOutAry Array of paths to write type definitions to.
 * @prop {string[]=} tsSchemaBarrelOutAry Array of paths to schema barrel file to.
 * @prop {string[]=} typeListOutAry Array of paths to write the type list as a JSON array to.
 * @prop {string[]=} typeListShortOutAry Array of paths to write the shortened type list as a JSON array to.
 *                                                Type props are written as an array of strings
 * @prop {string[]=} parsedSqlOutAry Array of paths to write parsed SQL to
 */

 /**
  * @typedef SrcType
  * @prop {string} name
  * @prop {string} baseName
  * @prop {string=} description
  * @prop {boolean=} insert
  * @prop {string[]} src
  * @prop {'type'|'enum'} type
  * @prop {number} order
  * @prop {PropDef[]} props
  */

 /**
  * @typedef TypeDef
  * @prop {string} name
  * @prop {string=} description
  * @prop {'type'|'enum'} type
  * @prop {string=} primaryKey
  * @prop {string=} sqlTable
  * @prop {string=} sqlSchema
  * @prop {PropDef[]} props
  */

 /**
  * @typedef PropDef
  * @prop {string} name
  * @prop {TypeMapping} type
  * @prop {boolean=} primary
  * @prop {string=} description
  * @prop {string=} sqlDef
  * @prop {boolean=} optional
  * @prop {boolean=} hasDefault
  * @prop {boolean=} isArray
  * @prop {number=} arrayDimensions
  */

 /**
  * @typedef TableMap
  * @prop {Record<string,string>} toTable
  * @prop {Record<string,string>} toName
  */

 /**
  * @typedef TypeMapping
  * @prop {string} name
  * @prop {string=} ts
  * @prop {string=} zod
  * @prop {string=} convo
  * @prop {string=} sql
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
        name:'number',
        zod:'z.number().int()',
    },
    int8:{
        name:'number',
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
    boolean:{
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
        if(!args.tsTypeDefOutAry?.length){
            args.tsTypeDefOutAry=args.outAry.map(p=>Path.join(p,'type-defs.ts'));
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
        if(!args.tsSchemaBarrelOutAry?.length && !args.disableSchemaBarrel){
            args.tsSchemaBarrelOutAry=args.outAry.map(p=>p+'.ts');
            if(!args.barrelBase){
                args.barrelBase=`./${Path.basename(args.outAry[0]??'schema')}/`;
            }
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

    const sql=sqlAry.join('\n\n');
    
    /** @type {import('@pgsql/types').ParseResult} */
    const parsedSql=await parse(sql);
    const statements=parsedSql.stmts??[];

    if(args.parsedSqlOutAry){
        print('Write parsed SQL');
        await writeAryAsync(args.parsedSqlOutAry,JSON.stringify(parsedSql,null,4));
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
        const c=getPgCreateEnum(s);
        if(!c){
            continue;
        }
        createEnum(c,sql,typeMap,typeDefs,tsTypes,zodTypes,convoTypes);
    }

    for(const s of statements){
        const c=getPgCreateTable(s);
        if(!c){
            continue;
        }
        createType(c,false,insertSuffix,sql,typeMap,tableMap,typeDefs,tsTypes,zodTypes,convoTypes);
        createType(c,true,insertSuffix,sql,typeMap,tableMap,typeDefs,tsTypes,zodTypes,convoTypes);
    }

    sortObj(typeDefs);
    const tsOut0=args.tsOutAry?.[0];
    const zodOut0=args.zodOutAry?.[0];

    await Promise.all([
        args.tsOutAry?writeAryAsync(args.tsOutAry,typesToString(tsTypes)):null,
        args.typeListOutAry?writeAryAsync(args.typeListOutAry,JSON.stringify(typeDefs,null,4)):null,
        args.typeListShortOutAry?writeAryAsync(args.typeListShortOutAry,JSON.stringify(typeDefs.map(t=>({
            ...t,
            props:t.props?.map(p=>p.name)
        })),null,4)):null,
        args.tsTypeDefOutAry?writeAryAsync(args.tsTypeDefOutAry,createTypeDescriptionFile(
            typeDefs,
            tsOut0?'./'+Path.basename(tsOut0):undefined,
            zodOut0?'./'+Path.basename(zodOut0):undefined,
            args.importExt
        )):null,
        args.zodOutAry?writeAryAsync(args.zodOutAry,typesToString(zodTypes),`import { z } from "zod";\n\n`):null,
        args.convoOutAry?writeAryAsync(args.convoOutAry,typesToString(convoTypes),'> define\n\n'):null,
        args.typeMapOutAry?writeAryAsync(args.typeMapOutAry,JSON.stringify(typeMap,null,4)):null,
        args.tableMapOutAry?writeAryAsync(args.tableMapOutAry,JSON.stringify(tableMap,null,4)):null,
        args.tsTableMapOutAry?writeAryAsync(args.tsTableMapOutAry,JSON.stringify(tableMap,null,4),`export const tableMap=`):null,
    ]);

    // always write barrel file last
    if(args.tsSchemaBarrelOutAry){
        await writeAryAsync(args.tsSchemaBarrelOutAry,getSchemaBarrel(
            args.barrelBase,
            args.tsTypeDefOutAry?.[0],
            args.tsTableMapOutAry?.[0],
            args.tsOutAry?.[0],
            args.zodOutAry?.[0],
            args.importExt
        ))
    }

}

const getSchemaBarrel=(
    barrelBase='./',
    typeDefsOut,
    tableMapOut,
    typesOut,
    zodOut,
    exts
)=>{
    const out=[];
    if(typeDefsOut){
        out.push(`export * from "${barrelBase}${getFileName(typeDefsOut,exts)}";\n`)
    }
    if(tableMapOut){
        out.push(`export * from "${barrelBase}${getFileName(tableMapOut,exts)}";\n`)
    }
    if(typesOut){
        out.push(`export * from "${barrelBase}${getFileName(typesOut,exts)}";\n`)
    }
    if(zodOut){
        out.push(`export * from "${barrelBase}${getFileName(zodOut,exts)}";\n`)
    }

    return out.join('');
}

/**
 * @param {string} path
 * @param {string=} ext 
 * @returns {string}
 */
const getFileName=(path,ext)=>{
    path=Path.basename(path);
    return replaceExt(path,ext);
}
/**
 * @param {string} path
 * @param {string=} ext 
 * @returns {string}
 */
const replaceExt=(path,ext)=>{
    const i=path.lastIndexOf('.');
    if(i!==-1){
        path=path.substring(0,i);
    }
    if(ext){
        path+='.'+ext;
    }
    return path;
}

/**
 * Creates a TypeScript file that defines types a object
 * @param {TypeDef[]} types 
 */
const createTypeDescriptionFile=(types,typesImport='./types.ts',zodImport='./types-zod.ts',ext)=>{
    const tt=types.filter(t=>t.type==='type');
    const out=[
        
`import type { ${tt.map(t=>`${t.name}, ${t.name}_insert`).join(', ')} } from "${replaceExt(typesImport,ext)}";
import { ${tt.map(t=>`${t.name}Schema, ${t.name}_insertSchema`).join(', ')} } from "${replaceExt(zodImport,ext)}";
import type { ZodType } from "zod";

export interface TypeMapping
{
    name:string;
    ts?:string;
    zod?:string;
    convo?:string;
    sql?:string;
}

export interface PropDef
{
    name:string;
    type:TypeMapping;
    primary?:boolean;
    description?:string;
    sqlDef?:string;
    optional?:boolean;
    hasDefault?:boolean;
    isArray?:boolean;
    arrayDimensions?:number;
}

export interface TypeDef<
    TValue extends Record<string,any>=Record<string,any>,
    TInsert extends Record<string,any>=Record<string,any>
>{


    name:string;
    description?:string;
    type:'type'|'enum';
    primaryKey:(keyof TValue) & (keyof TInsert);
    sqlTable?:string;
    sqlSchema?:string;
    zodSchema?:ZodType;
    zodInsertSchema?:ZodType;
    props:PropDef[];
}

export const typeDefs={
`
    ];
    
    for(const type of tt){
        const json=JSON.stringify(type,null,4);
        out.push(
`    ${type.name}: ${
        json.substring(0,json.length-1).trim()
            .replace(/\n( *)"(\w+)"/g,(_,s,p)=>`\n${s}${p}`)
            .replace(/\n/g,'\n    ')
    },
        zodSchema: ${type.name}Schema,
        zodInsertSchema: ${type.name}_insertSchema,
    } as TypeDef<${type.name},${type.name}_insert> satisfies TypeDef<${type.name},${type.name}_insert>,\n\n`
        )
    }

    out.push('\n} as const;\n\n');

    out.push(`export const typeList=[\n`);
    for(const type of tt){
        out.push(`    typeDefs.${type.name},\n`)
    }
    out.push('] as const;\n');

    return out.join('');
}

const sortObj=(obj)=>{
    if(Array.isArray(obj)){
        let allHasNames=true;
        for(const v of obj){
            if(typeof v?.name !== 'string'){
                allHasNames=false;
            }
            if(v && (typeof v ==='object')){
                sortObj(v);
            }
        }
        if(obj.length && allHasNames){
            obj.sort((a,b)=>a.name.localeCompare(b.name));
        }
    }else{
        const copy={...obj}
        const keys=Object.keys(obj);
        keys
            .sort()
            .sort((a,b)=>{
                const av=obj[a];
                const bv=obj[b];
                return (av && (typeof av === 'object')?1:0)-(bv && (typeof bv === 'object')?1:0);
            })
            .sort((a,b)=>(a==='name'?0:1)-(b==='name'?0:1));
        
        for(const e in obj){
            delete obj[e];
        }
        for(const key of keys){
            const v=copy[key];
            obj[key]=v;
            if(v && (typeof v ==='object')){
                sortObj(v);
            }
        }
    }
}

/**
 * @param {Pg.PgCreateTable} s
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
    const baseName=toTsName(s.name);
    const name=baseName+(forInsert?insertSuffix:'');
    if(!forInsert){
        tableMap.toName[s.name]=name;
    }
    tableMap.toTable[name]=s.name;

    const typeDescription=s.location && !forInsert?findComment(sql,s.location,true):undefined;

    /** @type {TypeDef} */
    const typeDef={
        name,
        type:'type',
        description:typeDescription,
        sqlTable:s.name,
        sqlSchema:s.schema,
        props:[],
    };

    /** @type {SrcType} */
    const tsType={name,baseName,src:[],type:'type',order:2,props:[]};
    /** @type {SrcType} */
    const zodType={name,baseName,src:[],type:'type',order:2,props:[]};
    /** @type {SrcType} */
    const convoType={name,baseName,src:[],type:'type',order:2,props:[]};


    tsType.src.push(`/**\n`);
    if(typeDescription){
        tsType.src.push(`${toJsDoc(typeDescription,'',true)}\n`);
        convoType.src.push(`${toConvoComment(typeDescription,'')}\n`);
    }
    if(forInsert){
        tsType.src.push(` * @insertFor ${baseName}\n`);
        convoType.src.push(`# insertFor: ${baseName}\n`);
    }
    tsType.src.push(` * @table ${s.name}\n`);
    convoType.src.push(`# table: ${s.name}\n`);
    if(s.schema){
        tsType.src.push(` * @schema ${s.schema}\n`);
        convoType.src.push(`# schema: ${s.schema}\n`);
    }
    tsType.src.push(' */\n');
    zodType.src.push(...tsType.src);
    zodType.src.splice(1,typeDescription?1:0,` * Zod schema for the "${name}" interface\n`);
    tsType.src.push(`export interface ${name}\n{\n`);
    zodType.src.push(`export const ${name}Schema=z.object({\n`);
    convoType.src.push(`${name} = struct(\n`);

    for(let ti=0;ti<s.tableElts.length;ti++){
        const tableItem=s.tableElts[ti];
        if(!tableItem){
            continue;
        }
        const c=getPgColumnDef(tableItem);
        if( !c ||
            !c.colname
        ){
            continue;
        }
        const prop=c.colname;
        let arrayDepth=c.typeName?.arrayBounds?.length??0;;
        const dataType=getPgTypeName(c.typeName);
        if(!dataType){
            continue;
        }
        const constraints=getPgConstraints(c.constraints);
        const notNull=constraints.some(c=>c.contype==='CONSTR_NOTNULL');
        const isPrimary=(
            constraints.some(c=>c.contype==='CONSTR_PRIMARY') ||
            s.constraintList.some(c=>c.contype==='CONSTR_PRIMARY' && getPgStrings(c.keys).includes(prop))
        );
        const hasDefault=constraints.some(c=>c.contype==='CONSTR_DEFAULT');
        const required=forInsert?((notNull || isPrimary) && !hasDefault):(notNull || isPrimary);
        const optional=!required;
        
        const sqlType=dataType;
        const sqlTypeLower=sqlType.toLowerCase();
        const mt=typeMap[sqlTypeLower]??typeMap['_default']??{name:'string'};

        const description=c.location && !forInsert?findComment(sql,c.location):undefined;

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

        const next=getPgColumnDef(s.tableElts[ti+1])??getPgConstraint(s.tableElts[ti+1]);

        typeDef.props.push({
            name:prop,
            type:{
                ...mt,
                ts:mt.ts??mt.name,
                sql:sqlType,
            },
            primary:isPrimary?true:undefined,
            description:description||undefined,
            sqlDef:c.location?removeTrailingComma(removeSqlComments(sql.substring(c.location,(
                next?.location??s.endLocation
            )))):undefined,
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

    typeDef.primaryKey=typeDef.props.find(p=>p.primary)?.name;
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
 * @param {Pg.PgCreateEnum} s
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
    const sqlName=s.name;
    const name=toTsName(sqlName);

    typeMap[sqlName]={
        name:name,
        zod:`${name}Schema`
    };

    const typeDescription=s.location?findComment(sql,s.location,true):undefined;

    /** @type {TypeDef} */
    const typeDef={name,type:'enum',description:typeDescription,props:[]};
    /** @type {SrcType} */
    const tsType={name,baseName:name,src:[],type:'enum',order:1,props:[]};
    /** @type {SrcType} */
    const zodType={name,baseName:name,src:[],type:'enum',order:1,props:[]};
    /** @type {SrcType} */
    const convoType={name,baseName:name,src:[],type:'enum',order:1,props:[]};


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


    const values=getPgStrings(s.vals).map(s=>JSON.stringify(s));

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