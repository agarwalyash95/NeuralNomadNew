import os
import sys
import django

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.db import connection

def drop_all_tables():
    with connection.cursor() as cursor:
        print("Dropping public schema cascade...")
        cursor.execute("DROP SCHEMA public CASCADE;")
        print("Recreating public schema...")
        cursor.execute("CREATE SCHEMA public;")
        print("Done.")

if __name__ == '__main__':
    drop_all_tables()
