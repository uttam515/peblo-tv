#!/bin/sh
set -e

echo "==> Waiting for database readiness..."
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
            print("==> Database is ready!")
            await engine.dispose()
            return
        except Exception as e:
            if i % 5 == 0:
                print(f"==> Waiting for database connection... ({i + 1}/{max_retries})")
            time.sleep(1)
    print("==> Failed to connect to database within timeout.")
    await engine.dispose()
    sys.exit(1)

asyncio.run(wait_for_db())
EOF

echo "==> Running database migrations (alembic upgrade head)..."
alembic upgrade head

echo "==> Running application bootstrap..."
python -m app.bootstrap

echo "==> Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
