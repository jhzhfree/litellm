#!/usr/bin/env python3
"""Split en.json leaf keys not yet translated in zh.json into batch source files for parallel translation."""

import json
import os
import sys

LOCALES = "ui/litellm-dashboard/src/i18n/locales"
SRC_DIR = "/tmp/litellm-zh-src"
MAX_BATCH_CHARS = 14000


def leaves(d, path=()):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from leaves(v, path + (k,))
        else:
            yield path + (k,)


def set_leaf(d, path, value):
    cur = d
    for k in path[:-1]:
        cur = cur.setdefault(k, {})
    cur[path[-1]] = value


def main():
    en = json.load(open(f"{LOCALES}/en.json"))
    zh = json.load(open(f"{LOCALES}/zh.json"))
    en_paths = list(leaves(en))

    def get(d, path):
        cur = d
        for k in path:
            if not isinstance(cur, dict) or k not in cur:
                return None
            cur = cur[k]
        return cur

    def first_missing(d, paths):
        for p in paths:
            if get(d, p) is None:
                return p
        return None

    pending = {}
    for p in en_paths:
        if get(zh, p) is None:
            pending[p] = str(get(en, p))

    ns_order, ns_items, ns_chars = [], {}, {}
    for p in pending:
        ns = p[0]
        if ns not in ns_items:
            ns_order.append(ns)
            ns_items[ns] = []
            ns_chars[ns] = 0
        ns_items[ns].append(p)
        ns_chars[ns] += len(pending[p])

    batches = []
    for ns in ns_order:
        if ns_chars[ns] > MAX_BATCH_CHARS:
            chunk, size = [], 0
            for p in ns_items[ns]:
                chunk.append(p)
                size += len(pending[p])
                if size > MAX_BATCH_CHARS:
                    batches.append(chunk)
                    chunk, size = [], 0
            if chunk:
                batches.append(chunk)
        else:
            if batches and sum(len(pending[p]) for p in batches[-1]) + ns_chars[ns] <= MAX_BATCH_CHARS and batches[-1][0][0] != ns:
                batches[-1].extend(ns_items[ns])
            else:
                batches.append(list(ns_items[ns]))

    os.makedirs(SRC_DIR, exist_ok=True)
    for old in os.listdir(SRC_DIR):
        os.remove(os.path.join(SRC_DIR, old))
    for i, paths in enumerate(batches, 1):
        out = {}
        for p in paths:
            set_leaf(out, p, pending[p])
        with open(f"{SRC_DIR}/batch_{i:02d}.json", "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=False)
        print(f"batch_{i:02d}.json: {len(paths)} keys, {sum(len(pending[p]) for p in paths)} chars, ns={sorted({p[0] for p in paths})}")
    print(f"TOTAL: {len(batches)} batches, {len(pending)} keys pending")


if __name__ == "__main__":
    main()
