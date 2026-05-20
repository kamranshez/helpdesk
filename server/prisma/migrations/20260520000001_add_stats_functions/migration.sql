-- get_ticket_stats(): returns all dashboard KPIs in one row
CREATE OR REPLACE FUNCTION get_ticket_stats()
RETURNS TABLE (
  "totalTickets"        BIGINT,
  "openTickets"         BIGINT,
  "aiResolved"          BIGINT,
  "totalResolved"       BIGINT,
  "avgResolutionTimeMs" DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                                              AS "totalTickets",
    COUNT(*) FILTER (WHERE status = 'open')                              AS "openTickets",
    COUNT(*) FILTER (WHERE "resolvedByAI" = TRUE)                        AS "aiResolved",
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))             AS "totalResolved",
    AVG(
      EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) * 1000
    ) FILTER (WHERE "resolvedAt" IS NOT NULL)                            AS "avgResolutionTimeMs"
  FROM ticket;
$$;

-- get_tickets_per_day(days INT): returns one row per day for the past N days
CREATE OR REPLACE FUNCTION get_tickets_per_day(days INT DEFAULT 30)
RETURNS TABLE (
  "date"  TEXT,
  "count" BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    TO_CHAR(d::date, 'YYYY-MM-DD') AS "date",
    COUNT(t.id)                    AS "count"
  FROM generate_series(
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - (days - 1),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
    INTERVAL '1 day'
  ) AS d
  LEFT JOIN ticket t
    ON t."createdAt"::date = d::date
  GROUP BY d
  ORDER BY d;
$$;
