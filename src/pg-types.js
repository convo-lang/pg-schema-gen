// @ts-check

/**
 * @import * as Pg from "pgsql-parser"
 *
 * @typedef PgCreateTableBase
 * @prop {string} name
 * @prop {string=} schema
 * @prop {number} location
 * @prop {number} endLocation
 * @prop {Pg.Constraint[]} constraintList
 * 
 * @typedef {Omit<Pg.CreateStmt,'tableElts'> & Required<Pick<Pg.CreateStmt,'tableElts'>> & PgCreateTableBase} PgCreateTable
 *
 * @typedef PgCreateEnumBase
 * @prop {string} name
 * @prop {number} location
 *
 * @typedef {Required<Pg.CreateEnumStmt> & PgCreateEnumBase} PgCreateEnum
 */


/**
 * @param {Pg.RawStmt|null|undefined} st 
 * @returns {PgCreateTable|undefined}
 */
export const getPgCreateTable=(st)=>{

    /** @type {Required<Pg.CreateStmt>} */
    const s=asAny(st?.stmt)?.CreateStmt;
    if(!s || !st){
        return undefined;
    }

    if(!s.tableElts || !s.relation?.relname){
        return undefined;
    }

    const name=s.relation.relname;

    return {
        ...s,
        name,
        schema:s.relation.schemaname,
        constraintList:getPgConstraints(s.tableElts),
        location:st.stmt_location??0,
        endLocation:(st.stmt_location??0)+(st.stmt_len??0),
    };
}

/**
 * @param {Pg.RawStmt|null|undefined} st 
 * @returns {PgCreateEnum|undefined}
 */
export const getPgCreateEnum=(st)=>{

    /** @type {Required<Pg.CreateEnumStmt>} */
    const s=asAny(st?.stmt)?.CreateEnumStmt;
    if(!s || !st){
        return undefined;
    }

    const name=getFirstPgString(s.typeName);
    if(!name || !s.vals){
        return undefined;
    }

    return {
        ...s,
        name,
        location:st.stmt_location??0,
    };
}

/**
 * @param {Pg.Node[]|null|undefined} nodes 
 * @returns {string[]}
 */
export const getPgStrings=(nodes)=>{
    if(!nodes){
        return [];
    }
    const strings=[];
    for(const node of nodes){
        const str=getPgString(node);
        if(str!==undefined){
            strings.push(str);
        }
    }
    return strings;
}

/**
 * @param {Pg.Node[]|null|undefined} nodes 
 * @returns {string|undefined}
 */
export const getFirstPgString=(nodes)=>{
    if(!nodes){
        return undefined;
    }
    for(const node of nodes){
        const str=getPgString(node);
        if(str!==undefined){
            return str;
        }
    }
    return undefined;
}

/**
 * @param {Pg.Node|null|undefined} node
 * @returns {string|undefined}
 */
export const getPgString=(node)=>{
    const str=asAny(node)?.String?.sval;
    return typeof str === 'string'?str:undefined;
}

/**
 * @param {Pg.Node|null|undefined} node 
 * @returns {Pg.ColumnDef|undefined}
 */
export const getPgColumnDef=(node)=>{
    return asAny(node)?.ColumnDef;
}

/**
 * @param {Pg.Node|null|undefined} node 
 * @returns {Pg.Constraint|undefined}
 */
export const getPgConstraint=(node)=>{
    return asAny(node)?.Constraint;
}

/**
 * @param {Pg.Node[]|null|undefined} nodes
 * @returns {Pg.Constraint[]}
 */
export const getPgConstraints=(nodes)=>{
    const list=[];
    if(!nodes){
        return list;
    }
    for(const n of nodes){
        const c=getPgConstraint(n);
        if(c){
            list.push(c);
        }
    }
    return list;
}

/**
 * @param {Pg.TypeName|null|undefined} typeName 
 * @returns {string|undefined}
 */
export const getPgTypeName=(typeName)=>{
    if(!typeName?.names){
        return undefined;
    }
    let name=undefined;
    for(const node of typeName.names){
        const n=getPgString(node);
        if(!n){
            continue;
        }
        if(!n.startsWith('pg_')){
            return n;
        }
        name=n;
    }
    return name;
}

/**
 * @param {any} value 
 * @returns {any}
 */
const asAny=(value)=>value;