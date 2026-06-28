export const sqliteDateYmdExpr = (fieldRef: string): string => `
  CASE
    WHEN trim(CAST(${fieldRef} AS TEXT)) GLOB '[0-9]*'
         AND trim(CAST(${fieldRef} AS TEXT)) NOT GLOB '*[^0-9]*'
    THEN
      CASE
        WHEN length(trim(CAST(${fieldRef} AS TEXT))) >= 13
        THEN strftime('%Y-%m-%d', CAST(CAST(${fieldRef} AS INTEGER) / 1000 AS INTEGER), 'unixepoch', '+9 hours')
        ELSE strftime('%Y-%m-%d', CAST(${fieldRef} AS INTEGER), 'unixepoch', '+9 hours')
      END
    ELSE COALESCE(
      strftime('%Y-%m-%d', CAST(${fieldRef} AS TEXT), '+9 hours'),
      substr(CAST(${fieldRef} AS TEXT), 1, 10)
    )
  END
`;
