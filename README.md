# pg-schema-gen
CLI tool to generate simple readable TypeScript, Zod and other schema files based on create table SQL statements.

Arguments:


| name                  | value   | multi | description                                     |
|-----------------------|---------|-------|-------------------------------------------------|
| --sql                 | sql     | Y     | SQL statement                                   |
| --sql-file            | path    | Y     | SQL file to load                                |
| --type-map-file       | path    | Y     | Type map JSON file                              |
| --clear-type-map      | boolean |       | Clear default type mapping                      |
| --insert-suffix       | suffix  |       | Suffix added to insert type                     |
| --silent              | boolean |       | Silence console logging                         |
| --verbose             | boolean |       | Enable verbose output                           |
| --ts-out              | path    | Y     | Path to write TypeScript type                   |
| --zod-out             | path    | Y     | Path to write Zod schema                        |
| --convo-out           | path    | Y     | Path to write Convo-Lang struct                 |
| --type-map-out        | path    | Y     | Path to write computed type map                 |
| --table-map-out       | path    | Y     | Path to write table map as JSON                 |
| --ts-table-map-out    | path    | Y     | Path to write table map as exported JSON object |
| --type-list-out       | path    | Y     | Path to write type list as JSON array           |
| --type-list-short-out | path    | Y     | Path to write shortened type list as JSON array |
| --parsed-sql-out      | path    | Y     | Path to write parsed SQL                        |


(multi) arguments can be specified multiple times.

## Example
``` sh
npx pg-schema-gen --sql-file schema.sql --ts-out src/types.ts --zod-out src/schemas.ts
```

Source SQL: `schema.sql`
``` sql
-- A cool dude
create table public.user (
  -- Id of the user
  id uuid not null default gen_random_uuid (),

  -- Time stamp when the user was created
  created_at timestamp with time zone not null default now(),
  name text not null,

  -- Valid email
  email text not null,
  account_id uuid not null,
  data jsonb not null,
  constraint user_pkey primary key (id),
  constraint user_account_id_fkey foreign KEY (account_id) references account (id) on delete CASCADE
);

-- extra data for stuff
create table public.data (
  id uuid not null default gen_random_uuid (),
  account_id uuid not null,
  created_at timestamp with time zone not null default now(),
  last_modified_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  modified_by_user_id uuid null,
  owner_user_id uuid null,
  public boolean not null default false,
  data jsonb not null,
  "table" text not null,
  constraint data_pkey primary key (id),
  constraint data_account_id_fkey foreign KEY (account_id) references account (id) on delete CASCADE,
  constraint data_created_by_user_id_fkey foreign KEY (created_by_user_id) references data (id) on delete set null,
  constraint data_modified_by_user_id_fkey foreign KEY (modified_by_user_id) references "user" (id) on delete set null,
  constraint data_owner_user_id_fkey foreign KEY (owner_user_id) references "user" (id) on delete set null
);

create index IF not exists data_table_idx on public.data using btree ("table");

create table public.account (
  id uuid not null default gen_random_uuid (),
  name text not null,
  created_at timestamp with time zone not null default now(),
  data jsonb not null,
  constraint account_pkey primary key (id)
);
```

TypeScript types: `src/types.ts`
``` ts
/**
 * @table account
 * @schema public
 */
export interface Account
{
    id:string;
    name:string;
    created_at:string;
    data:Record<string,any>;
}

/**
 * @insertFor Account
 * @table account
 * @schema public
 */
export interface AccountInsertion
{
    id?:string;
    name:string;
    created_at?:string;
    data:Record<string,any>;
}

/**
 * extra data for stuff
 * @table data
 * @schema public
 */
export interface Data
{
    id:string;
    account_id:string;
    created_at:string;
    last_modified_at:string;
    created_by_user_id?:string;
    modified_by_user_id?:string;
    owner_user_id?:string;
    public:string;
    data:Record<string,any>;
    table:string;
}

/**
 * @insertFor Data
 * @table data
 * @schema public
 */
export interface DataInsertion
{
    id?:string;
    account_id:string;
    created_at?:string;
    last_modified_at?:string;
    created_by_user_id?:string;
    modified_by_user_id?:string;
    owner_user_id?:string;
    public?:string;
    data:Record<string,any>;
    table:string;
}

/**
 * @table user
 * @schema public
 */
export interface User
{
    /**
     * Id of the user
     */
    id:string;
    /**
     * Time stamp when the user was created
     */
    created_at:string;
    name:string;
    /**
     * Valid email
     */
    email:string;
    account_id:string;
    data:Record<string,any>;
}

/**
 * @insertFor User
 * @table user
 * @schema public
 */
export interface UserInsertion
{
    id?:string;
    created_at?:string;
    name:string;
    email:string;
    account_id:string;
    data:Record<string,any>;
}
```

Zod Schemas: `src/schemas.ts`
``` ts
import { z } from "zod";

/**
 * Zod schema for the "Account" interface
 * @table account
 * @schema public
 */
export const AccountSchema=z.object({
    id:z.string(),
    name:z.string(),
    created_at:z.string(),
    data:z.record(z.string(),z.any()),
});

/**
 * Zod schema for the "AccountInsertion" interface
 * @insertFor Account
 * @table account
 * @schema public
 */
export const AccountInsertionSchema=z.object({
    id:z.string().optional(),
    name:z.string(),
    created_at:z.string().optional(),
    data:z.record(z.string(),z.any()),
});

/**
 * Zod schema for the "Data" interface
 * @table data
 * @schema public
 */
export const DataSchema=z.object({
    id:z.string(),
    account_id:z.string(),
    created_at:z.string(),
    last_modified_at:z.string(),
    created_by_user_id:z.string().optional(),
    modified_by_user_id:z.string().optional(),
    owner_user_id:z.string().optional(),
    public:z.string(),
    data:z.record(z.string(),z.any()),
    table:z.string(),
}).describe("extra data for stuff");

/**
 * Zod schema for the "DataInsertion" interface
 * @insertFor Data
 * @table data
 * @schema public
 */
export const DataInsertionSchema=z.object({
    id:z.string().optional(),
    account_id:z.string(),
    created_at:z.string().optional(),
    last_modified_at:z.string().optional(),
    created_by_user_id:z.string().optional(),
    modified_by_user_id:z.string().optional(),
    owner_user_id:z.string().optional(),
    public:z.string().optional(),
    data:z.record(z.string(),z.any()),
    table:z.string(),
});

/**
 * Zod schema for the "User" interface
 * @table user
 * @schema public
 */
export const UserSchema=z.object({
    id:z.string().describe("Id of the user"),
    created_at:z.string().describe("Time stamp when the user was created"),
    name:z.string(),
    email:z.string().describe("Valid email"),
    account_id:z.string(),
    data:z.record(z.string(),z.any()),
});

/**
 * Zod schema for the "UserInsertion" interface
 * @insertFor User
 * @table user
 * @schema public
 */
export const UserInsertionSchema=z.object({
    id:z.string().optional(),
    created_at:z.string().optional(),
    name:z.string(),
    email:z.string(),
    account_id:z.string(),
    data:z.record(z.string(),z.any()),
});
```