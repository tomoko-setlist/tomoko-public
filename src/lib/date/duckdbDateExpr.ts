export const duckdbDateYmdExpr = (fieldRef: string): string => `
  CASE
    WHEN TRY_CAST(CAST(${fieldRef} AS TEXT) AS BIGINT) IS NOT NULL
    THEN
      CASE
        WHEN length(trim(CAST(${fieldRef} AS TEXT))) >= 13
        THEN strftime('%Y-%m-%d', CAST(to_timestamp(TRY_CAST(CAST(${fieldRef} AS TEXT) AS BIGINT) / 1000.0) AS TIMESTAMP) + INTERVAL 9 HOUR)
        ELSE strftime('%Y-%m-%d', CAST(to_timestamp(TRY_CAST(CAST(${fieldRef} AS TEXT) AS BIGINT)) AS TIMESTAMP) + INTERVAL 9 HOUR)
      END
    WHEN TRY_CAST(CAST(${fieldRef} AS TEXT) AS TIMESTAMP) IS NOT NULL
    THEN strftime('%Y-%m-%d', TRY_CAST(CAST(${fieldRef} AS TEXT) AS TIMESTAMP) + INTERVAL 9 HOUR)
    ELSE substr(CAST(${fieldRef} AS TEXT), 1, 10)
  END
`;
