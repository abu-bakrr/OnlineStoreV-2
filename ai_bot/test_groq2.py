import os, asyncio, json
from dotenv import load_dotenv
from groq import AsyncGroq
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
async def main():
    try:
        client = AsyncGroq(api_key=os.getenv('GROQ_API_KEY'))
        sys_prompt = "You MUST respond strictly in JSON format. {\"thoughts\": \"...\", \"action\": {\"tool\": \"none\"}, \"response\": \"...\"}"
        res = await client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": "привет"}],
            response_format={"type": "json_object"}
        )
        print("L4:", res.choices[0].message.content)
    except Exception as e:
        print("L4 ERR:", type(e), str(e))
        
    try:
        client = AsyncGroq(api_key=os.getenv('GROQ_API_KEY'))
        sys_prompt = "You MUST respond strictly in JSON format. {\"thoughts\": \"...\", \"action\": {\"tool\": \"none\"}, \"response\": \"...\"}"
        res = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": "привет"}],
            response_format={"type": "json_object"}
        )
        print("L3:", res.choices[0].message.content)
    except Exception as e:
        print("L3 ERR:", type(e), str(e))
asyncio.run(main())
