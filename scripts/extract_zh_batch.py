#!/usr/bin/env python3
"""Extract a translated batch JSON from a subagent persisted-output file, validate it, and store it.

Usage: extract_batch.py <persisted_txt_or_raw_json> <batchNN>
Expects the text to contain one ```json fenced block (or be raw JSON itself).
Validates: same leaf paths as source, placeholders preserved per key.
Writes /tmp/litellm-zh-out/<batchNN>.json on success; exits 1 with a short report otherwise.
"""

import json
import os
import re
import sys

SRC = "/tmp/litellm-zh-src"
OUT = "/tmp/litellm-zh-out"


def leaves(d, path=()):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from leaves(v, path + (k,))
        else:
            yield path + (k,)


def placeholders(s):
    return sorted(re.findall(r"\{\{[^}]*\}\}", s))


def main():
    text_path, batch = sys.argv[1], sys.argv[2]
    text = open(text_path, encoding="utf-8", errors="replace").read()
    m = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    raw = m.group(1) if m else text
    try:
        out = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"{batch}: INVALID JSON: {e}")
        sys.exit(1)

    src = json.load(open(f"{SRC}/{batch}.json"))
    a, b = set(leaves(src)), set(leaves(out))
    if a != b:
        print(f"{batch}: PATH MISMATCH missing={len(a-b)} extra={len(b-a)} sample_missing={sorted(a-b)[:3]} sample_extra={sorted(b-a)[:3]}")
        sys.exit(1)

    def get(d, p):
        cur = d
        for k in p:
            cur = cur[k]
        return cur

    bad = []
    for p in a:
        sv, ov = str(get(src, p)), str(get(out, p))
        if placeholders(sv) != placeholders(ov):
            bad.append(p)
    if bad:
        print(f"{batch}: PLACEHOLDER MISMATCH on {len(bad)} keys, e.g. {bad[:3]}")
        sys.exit(1)

    os.makedirs(OUT, exist_ok=True)
    with open(f"{OUT}/{batch}.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    n = len(list(leaves(out)))
    print(f"{batch}: OK {n} keys")


if __name__ == "__main__":
    main()
