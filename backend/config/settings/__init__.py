"""
Settings package init - handles environment-based configuration
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# This file is intentionally empty
# Django will load settings from the appropriate environment module
