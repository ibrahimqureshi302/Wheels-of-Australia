#!/bin/bash
set -e

# Function to wait for database
wait_for_db() {
    echo "Waiting for database..."
    
    # Extract database connection details from DATABASE_URL if available
    if [ -n "$DATABASE_URL" ]; then
        # Use Python to extract host and port from DATABASE_URL
        DB_HOST=$(python -c "
import os
from urllib.parse import urlparse
db_url = os.environ.get('DATABASE_URL', '')
if db_url:
    parsed = urlparse(db_url)
    print(parsed.hostname or 'db')
else:
    print(os.environ.get('DB_HOST', 'db'))
")
        DB_PORT=$(python -c "
import os
from urllib.parse import urlparse
db_url = os.environ.get('DATABASE_URL', '')
if db_url:
    parsed = urlparse(db_url)
    print(parsed.port or 5432)
else:
    print(os.environ.get('DB_PORT', '5432'))
")
    else
        DB_HOST=${DB_HOST:-db}
        DB_PORT=${DB_PORT:-5432}
    fi
    
    echo "Checking database connection to $DB_HOST:$DB_PORT..."
    
    # Wait for database to be ready
    until python -c "
import psycopg
import sys
import os
from urllib.parse import urlparse

try:
    if os.environ.get('DATABASE_URL'):
        conn = psycopg.connect(os.environ['DATABASE_URL'])
    else:
        conn = psycopg.connect(
            host='$DB_HOST',
            port='$DB_PORT',
            user=os.environ.get('DB_USER', 'postgres'),
            password=os.environ.get('DB_PASSWORD', 'postgres'),
            dbname=os.environ.get('DB_NAME', 'postgres')
        )
    conn.close()
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    sys.exit(1)
"; do
        echo "Database is unavailable - sleeping"
        sleep 2
    done
    
    echo "Database is up!"
}

# Function to wait for Redis (if Celery is being used)
wait_for_redis() {
    if [ -n "$CELERY_BROKER_URL" ]; then
        echo "Waiting for Redis..."
        
        # Extract Redis host and port
        REDIS_HOST=$(python -c "
import os
from urllib.parse import urlparse
broker_url = os.environ.get('CELERY_BROKER_URL', '')
if broker_url:
    parsed = urlparse(broker_url)
    print(parsed.hostname or 'redis')
else:
    print('redis')
")
        REDIS_PORT=$(python -c "
import os
from urllib.parse import urlparse
broker_url = os.environ.get('CELERY_BROKER_URL', '')
if broker_url:
    parsed = urlparse(broker_url)
    print(parsed.port or 6379)
else:
    print('6379')
")
        
        echo "Checking Redis connection to $REDIS_HOST:$REDIS_PORT..."
        
        until python -c "
import redis
import sys
import os
from urllib.parse import urlparse

try:
    if os.environ.get('CELERY_BROKER_URL'):
        r = redis.from_url(os.environ['CELERY_BROKER_URL'])
    else:
        r = redis.Redis(host='redis', port=6379)
    r.ping()
    print('Redis connection successful')
except Exception as e:
    print(f'Redis connection failed: {e}')
    sys.exit(1)
"; do
            echo "Redis is unavailable - sleeping"
            sleep 2
        done
        
        echo "Redis is up!"
    fi
}

# Set DJANGO_SETTINGS_MODULE if not already set
export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-core.settings}

# Wait for services to be ready
wait_for_db
wait_for_redis

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files (only for main Django app, not Celery workers)
if [[ "$1" != "celery" ]]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
else
    echo "Skipping static files collection for Celery worker..."
fi

# Create superuser if requested
if [ "$DJANGO_SUPERUSER_EMAIL" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Creating superuser..."
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='$DJANGO_SUPERUSER_EMAIL').exists():
    User.objects.create_superuser(
        email='$DJANGO_SUPERUSER_EMAIL',
        password='$DJANGO_SUPERUSER_PASSWORD'
    )
    print('Superuser created successfully')
else:
    print('Superuser already exists')
"
fi

echo "Starting application..."

# Execute the command passed to the script
exec "$@"
