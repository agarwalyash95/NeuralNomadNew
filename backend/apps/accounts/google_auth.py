import urllib.request
import json

def verify_google_token(token, client_id):
    """
    Verifies a Google Access Token by fetching user info from Google.
    Returns None if verification fails.
    """
    try:
        req = urllib.request.Request('https://www.googleapis.com/oauth2/v3/userinfo')
        req.add_header('Authorization', f'Bearer {token}')
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Google token verification failed: {e}")
        return None
