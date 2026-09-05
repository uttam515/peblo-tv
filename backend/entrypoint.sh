#!/bin/sh
set -e

python - << 'EOF'
import asyncio
import os
import sys
import time
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/peblo_tv")

async def wait_for_db():
    engine = create_async_engine(database_url)
    max_retries = 30
    for i in range(max_retries):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            return
        except Exception:
            time.sleep(1)
    print("==> Failed to connect to database within timeout.", file=sys.stderr)
    await engine.dispose()
    sys.exit(1)

asyncio.run(wait_for_db())
EOF

alembic upgrade head
python -m app.bootstrap

echo ""
echo "CMS:    http://localhost:3000"
echo "Viewer: http://localhost:3001"
echo "API:    http://localhost:8000"
echo ""

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning --no-access-log
