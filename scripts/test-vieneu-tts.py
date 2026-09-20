"""Run inside tts container: python scripts/test-vieneu-tts.py (or docker compose exec -T tts python < script)."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

url = os.environ.get("VIENEU_TTS_URL", "http://tts:8000")
request = urllib.request.Request(url + "/generate", data=json.dumps({
    "text": "Xin chào các em học sinh. Hôm nay chúng ta sẽ học một bài học mới.",
    "voice": "default", "filename": "test-vieneu.wav"
}).encode(), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(request, timeout=900) as response:
    result = json.load(response)
output = Path(os.environ.get("STORAGE_ROOT", "/app/storage")) / result["audioPath"]
assert output.is_file() and output.stat().st_size > 44
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output)]))
assert float(probe["format"]["duration"]) > 0
assert any(s["codec_type"] == "audio" and int(s["sample_rate"]) == 48000 for s in probe["streams"])
print(json.dumps({"result": result, "probe": probe}, ensure_ascii=False, indent=2))
