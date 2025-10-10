| name               | value   | multi | description                                     |
|--------------------|---------|-------|-------------------------------------------------|
| --sql              | sql     | Y     | SQL statement                                   |
| --sql-file         | path    | Y     | SQL file to load                                |
| --type-map-file    | path    | Y     | Type map JSON file                              |
| --clear-type-map   | boolean |       | Clear default type mappings                     |
| --insert-suffix    | suffix  |       | Suffix added to insert type                     |
| --silent           | boolean |       | Silence output                                  |
| --verbose          | boolean |       | Enable verbose logging                          |
| --ts-out           | path    | Y     | Path to write TypeScript type                   |
| --zod-out          | path    | Y     | Path to write Zod schema                        |
| --convo-out        | path    | Y     | Path to write Convo-Lang struct                 |
| --type-map-out     | path    | Y     | Path to write computed type map                 |
| --table-map-out    | path    | Y     | Path to write table map as JSON                 |
| --ts-table-map-out | path    | Y     | Path to write table map as exported JSON object |
| --parsed-sql-out   | path    | Y     | Path to write parsed SQL                        |