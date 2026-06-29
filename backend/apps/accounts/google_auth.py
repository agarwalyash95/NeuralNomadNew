import requests

def verify_google_token(token, client_id):
    """
    Verifies a Google Access Token by fetching user info from Google.
    Returns None if verification fails.
    """
    try:
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        print(f"Google token verification failed with status: {response.status_code}, {response.text}")
        return None
    except Exception as e:
        print(f"Google token verification failed: {e}")
        return None
