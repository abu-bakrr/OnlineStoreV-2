import os
import asyncio
from dotenv import load_dotenv
from groq import AsyncGroq
import json

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
groq_key = os.getenv('GROQ_API_KEY')

async def main():
    client = AsyncGroq(api_key=groq_key)
    completion = await client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{"role": "user", "content": "привет"}],
        response_format={"type": "json_object"}
    )
    print("OUTPUT:", completion.choices[0].message.content)

asyncio.run(main())
