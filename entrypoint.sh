#!/bin/sh

set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec gunicorn project4.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 300

