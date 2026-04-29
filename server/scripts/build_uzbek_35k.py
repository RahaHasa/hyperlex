#!/usr/bin/env python3
"""Build a 35k Uzbek word list from public text corpora.

Outputs:
- server/data/uzbek_35k/uzbek_35k_real_words.csv
- server/data/uzbek_35k/uzbek_35k_stats.json

Sources:
- Local Uzbek corpus archive in server/data
- Optional remote fallback if local data is insufficient

The script keeps only Latin-script Uzbek-looking words, removes numeric prefixes,
normalizes apostrophes, deduplicates, and stops at 35k unique words.
"""

from __future__ import annotations

import bz2
import csv
import gzip
import json
import re
import tarfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_DIR = DATA_DIR / "uzbek_35k"
OUTPUT_CSV = OUTPUT_DIR / "uzbek_35k_real_words.csv"
OUTPUT_STATS = OUTPUT_DIR / "uzbek_35k_stats.json"

TATOEBA_URL = "https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge-data/main/data/uz/uz_sentences.tsv"
LOCAL_ARCHIVE = DATA_DIR / "uzb_news_2020_30K.tar.gz"
LOCAL_LINKS = DATA_DIR / "uzb-rus_links.tsv.bz2"

# Uzbek Latin alphabet with common apostrophe variants and hyphen.
UZ_ALLOWED_RE = re.compile(r"^[a-z'’ʻʻʼʿ`-]+$")
NUM_PREFIX_RE = re.compile(r"^\d+[\.)\s-]*")
WORD_TOKEN_RE = re.compile(r"[a-zA-Z'’ʻʻʼʿ`-]{2,}")
CYRILLIC_RE = re.compile(r"[А-Яа-яЁёЎўҒғҚқҲҳ]")


@dataclass
class SourceStats:
    name: str
    tokens: int = 0
    accepted: int = 0


def normalize_apostrophes(text: str) -> str:
    return (
        text.replace("’", "'")
        .replace("ʻ", "'")
        .replace("ʼ", "'")
        .replace("ʿ", "'")
        .replace("`", "'")
    )


def clean(word: str) -> Optional[str]:
    if not word:
        return None

    word = normalize_apostrophes(str(word).lower().strip())
    word = NUM_PREFIX_RE.sub("", word)
    word = word.strip(".!,?;:\"()[]{}<>«»“”' \t\r\n")
    word = re.sub(r"\s+", "", word)

    if not word:
        return None

    # Skip Cyrillic or mixed-script entries.
    if CYRILLIC_RE.search(word):
        return None

    # Keep only likely Uzbek Latin words.
    if not UZ_ALLOWED_RE.match(word):
        return None

    # Avoid very short noise.
    letters_only = re.sub(r"[^a-z]", "", word)
    if len(letters_only) < 2:
        return None

    return word


def read_remote_tatoeba() -> Iterator[str]:
    try:
        with urlopen(TATOEBA_URL, timeout=60) as response:
            text = response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError):
        return

    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) > 1:
            yield parts[1]


def read_text_lines(path: Path) -> Iterator[str]:
    if path.suffix == ".gz":
        opener = gzip.open
    elif path.suffix == ".bz2":
        opener = bz2.open
    else:
        opener = open

    with opener(path, "rt", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            yield line.rstrip("\n")


def read_tar_gz(path: Path) -> Iterator[str]:
    with tarfile.open(path, "r:gz") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            if member.size == 0:
                continue
            if not member.name.lower().endswith((".txt", ".tsv", ".csv")):
                continue
            extracted = archive.extractfile(member)
            if not extracted:
                continue
            content = extracted.read().decode("utf-8", errors="ignore")
            for line in content.splitlines():
                yield line


def read_uzbek_archive(path: Path) -> Iterator[str]:
    with tarfile.open(path, "r:gz") as archive:
        preferred_files = [
            "uzb_news_2020_30K/uzb_news_2020_30K-sentences.txt",
            "uzb_news_2020_30K/uzb_news_2020_30K-words.txt",
            "uzb_news_2020_30K/uzb_news_2020_30K-co_s.txt",
            "uzb_news_2020_30K/uzb_news_2020_30K-inv_so.txt",
        ]

        names = set(archive.getnames())
        for file_name in preferred_files:
            if file_name not in names:
                continue

            extracted = archive.extractfile(file_name)
            if not extracted:
                continue

            content = extracted.read().decode("utf-8", errors="ignore")
            for line in content.splitlines():
                yield line


def extract_words_from_wordlist_line(line: str) -> Iterator[str]:
    text = line.strip()
    if not text:
        return

    parts = text.split(maxsplit=1)
    if len(parts) == 2 and parts[0].isdigit():
        yield parts[1]
    else:
        yield text


def read_local_sources() -> Iterator[str]:
    if LOCAL_ARCHIVE.exists():
        yield from read_uzbek_archive(LOCAL_ARCHIVE)

    if LOCAL_LINKS.exists():
        yield from read_text_lines(LOCAL_LINKS)


def extract_words(text: str) -> Iterator[str]:
    text = normalize_apostrophes(text.lower())
    for token in WORD_TOKEN_RE.findall(text):
        yield token


def build_vocab(raw_texts: Iterable[str], limit: int = 35000) -> tuple[list[str], Counter, int]:
    counter: Counter[str] = Counter()
    total_tokens = 0

    for text in raw_texts:
        for token in extract_words(text):
            total_tokens += 1
            cleaned = clean(token)
            if cleaned:
                counter[cleaned] += 1

    ranked = [word for word, _ in counter.most_common()]
    ranked = [word for word in ranked if len(word) <= 16]

    # Prefer more common, simpler-looking words.
    result = ranked[:limit]
    return result, counter, total_tokens


def save_csv(words: list[str], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["word"])
        for word in words:
            writer.writerow([word])


def save_stats(path: Path, *, words: list[str], total_tokens: int, sources: list[SourceStats]) -> None:
    payload = {
        "total_unique_words": len(words),
        "total_tokens": total_tokens,
        "output_csv": str(OUTPUT_CSV),
        "sources": [source.__dict__ for source in sources],
        "sample": words[:100],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sources: list[SourceStats] = []
    raw_texts: list[str] = []

    print("Loading local Uzbek corpus...")
    local_count = 0
    for line in read_local_sources():
        raw_texts.append(line)
        local_count += 1
    sources.append(SourceStats(name="local_corpora", tokens=local_count))

    if len(raw_texts) < 5000:
        print("Local data is small, trying remote Tatoeba fallback...")
        remote_count = 0
        for sentence in read_remote_tatoeba():
            raw_texts.append(sentence)
            remote_count += 1
        sources.append(SourceStats(name="tatoeba_uz_sentences", tokens=remote_count))

    print("Building vocabulary...")
    words, counter, total_tokens = build_vocab(raw_texts, limit=35000)

    if len(words) < 35000:
        print(f"Warning: only {len(words)} unique words collected, below target 35000")

    save_csv(words, OUTPUT_CSV)
    save_stats(OUTPUT_STATS, words=words, total_tokens=total_tokens, sources=sources)

    print(f"Done: {len(words)} words saved to {OUTPUT_CSV}")
    print(f"Stats saved to {OUTPUT_STATS}")


if __name__ == "__main__":
    main()
