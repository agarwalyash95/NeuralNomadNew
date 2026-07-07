import requests

def verify_google_token(token, client_id):
    """
    Verifies a Google Access Token or ID Token by querying Google's APIs.
    Returns user dict (email, name, etc.) or None if verification fails.
    """
    try:
        # 1. Try UserInfo endpoint (for OAuth access_token)
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()

        # 2. Fallback to TokenInfo endpoint (for id_token JWT credential)
        id_response = requests.get(
            f'https://oauth2.googleapis.com/tokeninfo?id_token={token}',
            timeout=10
        )
        if id_response.status_code == 200:
            data = id_response.json()
            # Map id_token fields to standard userinfo structure
            return {
                'email': data.get('email'),
                'name': data.get('name') or data.get('given_name', ''),
                'sub': data.get('sub'),
                'picture': data.get('picture', '')
            }

        print(f"Google token verification failed. userinfo status: {response.status_code}, tokeninfo status: {id_response.status_code}")
        return None
    except Exception as e:
        print(f"Google token verification failed: {e}")
        return None

