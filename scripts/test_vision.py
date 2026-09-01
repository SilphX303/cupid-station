"""Probe a vision endpoint the same way Cupid Station's ingest will use it.

Stdlib only — runs anywhere Python 3 exists, no pip install needed.

    python scripts/test_vision.py http://10.0.1.235:8000/v1 qwen3-omni

Sends a tiny generated test image (left half red, right half blue) and checks
the model can actually see it. Exit 0 = vision works; the printed answer
should mention red on the left and blue on the right.
"""
import json
import sys
import urllib.request

# 96x64 PNG, left half red / right half blue (pre-generated, stdlib-friendly)
TEST_IMAGE_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABACAIAAABqVuVZAAAAoklEQVR4nO3QMRGAQBDAQEDIyUIk"
    "SpBFTbXlf5FVkMn5zhw7uedZnfBzrQ7YXYOgQdAgaBA0CBoEDYIGQYOgQdAgaBA0CBoEDYIGQYOg"
    "QdAgaBA0CBoEDYIGQYOgQdAgaBA0CBoEDYIGQYOgQdAgaBA0CBoEDYIGQYOgQdAgaBA0CBoEDYIG"
    "QYOgQdAgaBA0CBoEDYIGQYOgQdAgaBA0CBoEH9X3AqLxbXdSAAAAAElFTkSuQmCC"
)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    base, model = sys.argv[1].rstrip("/"), sys.argv[2]
    key = sys.argv[3] if len(sys.argv) > 3 else "none"

    body = {
        "model": model,
        "max_tokens": 60,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url",
                 "image_url": {"url": f"data:image/png;base64,{TEST_IMAGE_B64}"}},
                {"type": "text",
                 "text": "This image is split into two halves. What colour is the "
                         "left half and what colour is the right half? One short sentence."},
            ],
        }],
    }
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            answer = json.load(resp)["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} from the endpoint:\n{e.read().decode()[:800]}")
        print("\nIf this complains about images/multimodal input, vLLM likely needs "
              "the model served with image support (e.g. --limit-mm-per-prompt image=4).")
        return 1

    print(f"Model answered: {answer.strip()}")
    ok = "red" in answer.lower() and "blue" in answer.lower()
    print("\nVISION OK — set these on the container and redeploy:" if ok else
          "\nModel replied but did NOT describe the image correctly — vision may be "
          "misconfigured (check vLLM multimodal flags / chat template).")
    if ok:
        print(f"  CUPID_VISION_BASE_URL={base}")
        print(f"  CUPID_VISION_MODEL={model}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
