import json
import re

transcript_path = r'C:\Users\ASUS\.gemini\antigravity-ide\brain\d3144b11-4e21-42cd-8a1b-7ecf32a68a66\.system_generated\logs\transcript_full.jsonl'
last_user_input = ''

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip(): continue
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                last_user_input = data.get('content', '')
        except: pass

match = re.search(r'Comment:\s*\"(.*)\"$', last_user_input, re.DOTALL)
if match:
    plan_content = match.group(1)
    # The comment string contains literal escaped characters if it was JSON encoded, but json.loads handled it.
    # We write it directly.
    with open(r'C:\Users\ASUS\.gemini\antigravity-ide\brain\d3144b11-4e21-42cd-8a1b-7ecf32a68a66\implementation_plan.md', 'w', encoding='utf-8') as f:
        f.write(plan_content)
    print("Success")
else:
    print('Failed to match')
