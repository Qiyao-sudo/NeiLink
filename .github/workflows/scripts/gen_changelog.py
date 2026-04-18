import os
import requests
from pathlib import Path
from datetime import datetime

# 读取环境变量
API_KEY = os.getenv("LLM_API_KEY")
API_URL = os.getenv("LLM_API_ENDPOINT")
MODEL = os.getenv("LLM_API_MODEL")

main_version = os.getenv("MAIN_VERSION")
sub_version = os.getenv("SUB_VERSION")
current_tag = os.getenv("CURRENT_TAG")

# 获取当前日期
update_date = datetime.now().strftime("%Y-%m-%d")

# 读取commit差异日志
with open("commit_diff.txt", "r", encoding="utf-8") as f:
    commit_content = f.read().strip()

# 读取模板文件
with open(".github/workflows/scripts/template.txt", "r", encoding="utf-8") as f:
    template = f.read().strip()



## 构造专业Prompt，让LLM输出标准结构化Changelog
prompt = template.format(
    main_version=main_version,
    sub_version=sub_version,
    current_tag=current_tag,
    update_date=update_date,
    commit_content=commit_content
)

# 请求LLM API
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
body = {
    "model": MODEL,
    "messages": [
        {"role": "user", "content": prompt}
    ],
    "temperature": 0.3  # 低随机性，保证文档稳定
}

resp = requests.post(API_URL, json=body, headers=headers, timeout=60)
resp.raise_for_status()
result = resp.json()
changelog_md = result["choices"][0]["message"]["content"]

# 创建目标目录：doc/{主版本号}/{版本号}/
save_dir = Path(f"doc/Changelogs/{main_version}/{sub_version}")
save_dir.mkdir(parents=True, exist_ok=True)

# 写入App.md文件
save_path = save_dir / "App.md"
with open(save_path, "w", encoding="utf-8") as f:
    f.write(changelog_md)

print(f"Changelog 已生成完毕，路径：{save_path}")
