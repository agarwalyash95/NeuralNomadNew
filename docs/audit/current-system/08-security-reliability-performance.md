# Security, Reliability, and Performance
## Findings
1. **Critical:** Missing idempotency keys on `POST /api/wallet/create_order/` could lead to double billing.
2. **High:** Thread fallback for Celery in `apps.planner.views` could cause memory leaks or lost jobs in production if `celery_worker_available()` fails incorrectly.
3. **Medium:** Rate limiting uses cache counters which may be evicted early under memory pressure.
4. **Informational:** `DEBUG = True` by default in `.env.example`, ensure production deployment strictly sets this to `False`.
