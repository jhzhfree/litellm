#!/usr/bin/env python3
"""Deep-merge translated batches over existing zh.json (existing wins), validate against en.json, write atomically."""

import json
import os
import sys

LOCALES = "ui/litellm-dashboard/src/i18n/locales"
OUT = "/tmp/litellm-zh-out"


def leaves(d, path=()):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from leaves(v, path + (k,))
        else:
            yield path + (k,)


def deep_merge(base, extra):
    for k, v in extra.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v


def get(d, p):
    cur = d
    for k in p:
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur


def set_leaf(d, p, v):
    cur = d
    for k in p[:-1]:
        cur = cur.setdefault(k, {})
    cur[p[-1]] = v


def main():
    en = json.load(open(f"{LOCALES}/en.json"))
    zh = json.load(open(f"{LOCALES}/zh.json"))
    en_paths = {p for p in leaves(en)}

    before = len({p for p in leaves(zh)})
    merged = 0
    for name in sorted(os.listdir(OUT)):
        part = json.load(open(f"{OUT}/{name}"))
        for p in leaves(part):
            if p in en_paths and get(zh, p) is None:
                set_leaf(zh, p, str(get(part, p)))
                merged += 1
            elif p not in en_paths:
                print(f"WARN: {name} has key not in en.json: {'.'.join(p)}")

    zh_paths = {p for p in leaves(zh)}
    missing = en_paths - zh_paths
    extra = zh_paths - en_paths

    tmp = f"{LOCALES}/zh.json.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(zh, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, f"{LOCALES}/zh.json")

    print(f"keys before: {before}")
    print(f"merged: {merged}")
    print(f"total zh keys: {len(zh_paths)} / {len(en_paths)} en keys")
    if missing:
        print(f"MISSING {len(missing)}: {sorted(missing)[:5]}")
    if extra:
        print(f"EXTRA {len(extra)}: {sorted(extra)[:5]}")
    sys.exit(1 if missing or extra else 0)


if __name__ == "__main__":
    main()
