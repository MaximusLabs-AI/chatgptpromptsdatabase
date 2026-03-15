import pandas as pd
from datasets import load_dataset
import os
import re
import sqlite3
import json
import time
from typing import List, Dict
from groq import Groq
from dotenv import load_dotenv

# Load environment variables (GROQ_API_KEY)
load_dotenv()

client = Groq()

def clean_pii(text: str) -> str:
    # Remove emails
    text = re.sub(r'\S+@\S+', '[EMAIL]', text)
    # Remove phone numbers (various formats)
    text = re.sub(r'\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}', '[PHONE]', text)
    # Remove IP addresses
    text = re.sub(r'\b\d{1,3}(?:\.\d{1,3}){3}\b', '[IP_ADDRESS]', text)
    return text

def categorize_prompts_batch(prompts: List[str]) -> List[str]:
    """
    Categorizes a batch of prompts using Groq (openai/gpt-oss-120b).
    """
    if not prompts:
        return []
    
    system_prompt = """You are a prompt categorizer. Given a list of user prompts, classify EACH one into one of these categories:
- Writing
- Coding
- Research
- Business
- Education
- Creative
- Personal
- Technical
- Other

Respond with a JSON object like {"categories": ["Category1", "Category2", ...]} where the order matches the input list."""

    user_content = json.dumps(prompts)
    
    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
        )
        content = completion.choices[0].message.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
            
        categories = json.loads(content).get("categories", [])
        return categories
    except Exception as e:
        print(f"Error categorizing batch: {e}")
        return ["Other"] * len(prompts)

def run_pipeline(limit=1000000):
    print("Loading WildChat-1M dataset from HuggingFace...")
    dataset = load_dataset("allenai/WildChat-1M", split="train", streaming=True)
    
    db_path = "../api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/42cbb3a5d5341bb62286ff1beaece85996dc9c640fa5af541a0702f2c1be74b2.sqlite"
    count = 0
    batch_size = 50
    current_batch = []
    
    print(f"Starting real-time injection to {db_path}...")
    conn = sqlite3.connect(db_path)
    
    for entry in dataset:
        if count >= limit:
            break
        
        conv = entry.get('conversation', [])
        if not conv:
            continue
            
        # Extract first user prompt
        user_prompt = ""
        for msg in conv:
            if msg['role'] == 'user':
                user_prompt = msg['content']
                break
        
        if not user_prompt:
            continue
            
        # Toxicity filtering
        toxicity_score = entry.get('toxicity', 0.0)
        if isinstance(toxicity_score, (list, tuple)):
            toxicity_score = toxicity_score[0] if toxicity_score else 0.0
            
        if toxicity_score > 0.7:
            continue
            
        user_prompt = clean_pii(user_prompt)
        model_res = conv[1]['content'] if len(conv) > 1 else ""
        model_res = clean_pii(model_res) # Clean PII from model response too
        
        current_batch.append({
            'user_prompt': user_prompt,
            'model_response': model_res,
            'platform': entry.get('model', 'unknown'),
            'language': entry.get('language', 'en'),
            'timestamp': str(entry.get('timestamp', '')),
            'toxicity_score': toxicity_score
        })
        
        count += 1
        if len(current_batch) >= batch_size:
            # Categorize the batch
            prompts_only = [item['user_prompt'] for item in current_batch]
            cats = categorize_prompts_batch(prompts_only)
            
            if len(cats) < len(current_batch):
                cats.extend(["Other"] * (len(current_batch) - len(cats)))
                
            for i, item in enumerate(current_batch):
                item['category'] = cats[i]
                
            # Insert to DB
            df = pd.DataFrame(current_batch)
            df.to_sql('conversations', conn, if_exists='append', index=False)
            
            print(f"Injecting {batch_size} records... Total Processed: {count}")
            current_batch = []
            
            time.sleep(0.5)

    # Insert remaining records
    if current_batch:
        prompts_only = [item['user_prompt'] for item in current_batch]
        cats = categorize_prompts_batch(prompts_only)
        
        if len(cats) < len(current_batch):
            cats.extend(["Other"] * (len(current_batch) - len(cats)))
            
        for i, item in enumerate(current_batch):
            item['category'] = cats[i]
            
        df = pd.DataFrame(current_batch)
        df.to_sql('conversations', conn, if_exists='append', index=False)
        print(f"Injecting final {len(current_batch)} records... Total Processed: {count}")

    conn.close()
    print("Pipeline finished successfully.")

if __name__ == "__main__":
    run_pipeline(limit=1000000)
