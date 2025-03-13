import os
from dotenv import load_dotenv
load_dotenv(override=True)

# Get environment variables
ULTRAVOX_API_KEY = os.environ.get('ULTRAVOX_API_KEY')
PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')
N8N_WEBHOOK_URL = os.environ.get('N8N_WEBHOOK_URL')
PUBLIC_URL = os.environ.get('PUBLIC_URL')
DB_URL = os.environ.get('DB_URL')
BACKEND_URL = os.environ.get('BACKEND_URL')
PORT = int(os.environ.get('PORT', '8000'))
