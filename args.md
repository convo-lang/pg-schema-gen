| name               | value   | multi | description                                     |
|--------------------|---------|-------|-------------------------------------------------|
| --sql              | sql     | Y     | SQL statement                                   |
| --sql-file         | path    | Y     | SQL file to load                                |
| --type-map-file    | path    | Y     | Type map JSON file                              |
| --clear-type-map   | boolean |       | Clear default type mapping                      |
| --insert-suffix    | suffix  |       | Suffix added to insert type                     |
| --silent           | boolean |       | Silence console logging                         |
| --verbose          | boolean |       | Enable verbose output                           |
| --ts-out           | path    | Y     | Path to write TypeScript type                   |
| --zod-out          | path    | Y     | Path to write Zod schema                        |
| --convo-out        | path    | Y     | Path to write Convo-Lang struct                 |
| --type-map-out     | path    | Y     | Path to write computed type map                 |
| --table-map-out    | path    | Y     | Path to write table map as JSON                 |
| --ts-table-map-out | path    | Y     | Path to write table map as exported JSON object |
| --type-list-out    | path    | Y     | Path to write type list as JSON array           |
| --parsed-sql-out   | path    | Y     | Path to write parsed SQL                        |