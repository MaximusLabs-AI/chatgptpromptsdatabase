import requests
import time

API_URL = "http://localhost:8787"

def test_pagination_sanitization():
    print("Testing pagination sanitization...")
    # Request a very large limit
    res = requests.get(f"{API_URL}/api/prompts?limit=1000")
    if res.status_code == 200:
        data = res.json()
        results_count = len(data.get('results', []))
        print(f"Requested limit=1000, got {results_count} results.")
        if results_count <= 100:
            print("✅ Pagination sanitization working (capped at 100).")
        else:
            print("❌ Pagination sanitization failed (exceeded 100).")
    else:
        print(f"❌ API request failed with status {res.status_code}")

def test_rate_limiting():
    print("\nTesting rate limiting (30 requests/hour/IP)...")
    # This test might fail if CACHE_KV is not actually working in the local dev environment
    # or if we've already hit the limit.
    for i in range(35):
        res = requests.get(f"{API_URL}/api/prompts?limit=1")
        if res.status_code == 429:
            print(f"✅ Rate limit hit at request {i+1}.")
            return
        elif res.status_code != 200:
            print(f"❌ Unexpected status code {res.status_code} at request {i+1}.")
            return
        if (i + 1) % 5 == 0:
            print(f"  Sent {i+1} requests...")
    
    print("❌ Rate limit NOT hit after 35 requests.")

if __name__ == "__main__":
    print("Note: Ensure the API is running at http://localhost:8787 before running this test.")
    try:
        test_pagination_sanitization()
        # test_rate_limiting() # Uncomment if you want to test rate limiting (be aware it uses up your quota)
    except Exception as e:
        print(f"Error running tests: {e}")
