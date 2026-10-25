# Runs inside the Railway api container (see run.mjs). Prints every row of every table as one JSON
# line, converted to the D1 storage format: ISO-8601 UTC timestamps with milliseconds, YYYY-MM-DD dates,
# 0/1 booleans, JSON columns as text and numerics as floats. Read-only.
import datetime
import decimal
import json

from sqlalchemy import select

import app.models  # noqa: F401
from app.core.database import Base, engine


def convert(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        value = value.astimezone(datetime.timezone.utc)
        return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value


print("@@BEGIN")
options = {"isolation_level": "REPEATABLE READ", "postgresql_readonly": True} if engine.dialect.name == "postgresql" else {}
with engine.connect().execution_options(**options) as conn:
    with conn.begin():
        for table in Base.metadata.sorted_tables:
            for row in conn.execute(select(table)).mappings():
                record = {"t": table.name, "r": {key: convert(val) for key, val in row.items()}}
                print(json.dumps(record, ensure_ascii=False))
print("@@END")
