"""Step 2/3 of the perceptual-match pipeline.

Reads the manifest scripts/retired/media/prepare-perceptual-match.ts wrote
(../../artifacts/media-hash-diff/perceptual-input.json), embeds every legacy
and candidate image with DINOv2, and for each finding picks the
highest-cosine-similarity candidate from that same article — chosen over a
plain byte/perceptual hash because the maintainer confirmed 2024-2025 photos
were often re-supplied as fresh originals (crop/color/orientation can all
differ from the legacy 480px copy; a hash-based approach would false-negative
on exactly the cases this pipeline exists to catch).

Three buckets, by cosine similarity of the best candidate (thresholds are a
starting point, not tuned against ground truth yet - eyeball the "maybe"
bucket in step 3 before trusting them):
  - same       (>= 0.90): almost certainly the same photo, re-supplied.
  - maybe      (>= 0.75): plausible, needs a human look.
  - no_match   (< 0.75, or zero candidates on the article at all).

Writes ../../artifacts/media-hash-diff/perceptual-match.json. Does not touch
the waiver file - that's step 3 (scripts/retired/media/review-perceptual-matches.ts).

Usage: uv run match.py
"""

import json
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

MODEL_NAME = "facebook/dinov2-small"
REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "artifacts/media-hash-diff/perceptual-input.json"
OUTPUT_PATH = REPO_ROOT / "artifacts/media-hash-diff/perceptual-match.json"

SAME_THRESHOLD = 0.90
MAYBE_THRESHOLD = 0.75


def resolve_path(relative: str) -> str:
    """Manifest paths are repo-relative (written by a bun script whose cwd is
    the repo root); resolve them against REPO_ROOT since this script's own
    cwd is tools/perceptual-match/ when run via `uv run match.py`."""
    return str(REPO_ROOT / relative)


def load_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        raise SystemExit(
            f"{MANIFEST_PATH} not found - run "
            "`bun run scripts/retired/media/prepare-perceptual-match.ts` first."
        )
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


@torch.no_grad()
def embed_images(paths: list[str], processor, model, device) -> dict[str, torch.Tensor]:
    embeddings: dict[str, torch.Tensor] = {}
    for path in paths:
        if path in embeddings:
            continue
        try:
            image = Image.open(path).convert("RGB")
        except Exception as error:  # corrupt download, truncated fetch, etc.
            print(f"  ! could not open {path}: {error}")
            continue
        inputs = processor(images=image, return_tensors="pt").to(device)
        # CLS token of the last hidden state is DINOv2's standard image embedding.
        output = model(**inputs).last_hidden_state[:, 0, :]
        embeddings[path] = torch.nn.functional.normalize(output, dim=-1).squeeze(0)
    return embeddings


def bucket_for(similarity: float) -> str:
    if similarity >= SAME_THRESHOLD:
        return "same"
    if similarity >= MAYBE_THRESHOLD:
        return "maybe"
    return "no_match"


def main() -> None:
    manifest = load_manifest()
    print(f"Loaded {len(manifest)} manifest entrie(s).")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading {MODEL_NAME} on {device}...")
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device).eval()

    all_paths = {resolve_path(entry["legacy_path"]) for entry in manifest}
    for entry in manifest:
        all_paths.update(resolve_path(c["path"]) for c in entry["candidates"])
    print(f"Embedding {len(all_paths)} distinct image(s)...")
    embeddings = embed_images(sorted(all_paths), processor, model, device)

    results = []
    for entry in manifest:
        legacy_embedding = embeddings.get(resolve_path(entry["legacy_path"]))
        if legacy_embedding is None:
            results.append(
                {
                    "legacy_id": entry["legacy_id"],
                    "article_id": entry["article_id"],
                    "title": entry["title"],
                    "legacy_url": entry["legacy_url"],
                    "best_media_id": None,
                    "similarity": None,
                    "bucket": "no_match",
                    "reason": "legacy image failed to open",
                }
            )
            continue

        best_media_id = None
        best_similarity = -1.0
        for candidate in entry["candidates"]:
            candidate_embedding = embeddings.get(resolve_path(candidate["path"]))
            if candidate_embedding is None:
                continue
            similarity = torch.dot(legacy_embedding, candidate_embedding).item()
            if similarity > best_similarity:
                best_similarity = similarity
                best_media_id = candidate["media_id"]

        if best_media_id is None:
            results.append(
                {
                    "legacy_id": entry["legacy_id"],
                    "article_id": entry["article_id"],
                    "title": entry["title"],
                    "legacy_url": entry["legacy_url"],
                    "best_media_id": None,
                    "similarity": None,
                    "bucket": "no_match",
                    "reason": "no candidate images on this article",
                }
            )
            continue

        results.append(
            {
                "legacy_id": entry["legacy_id"],
                "article_id": entry["article_id"],
                "title": entry["title"],
                "legacy_url": entry["legacy_url"],
                "best_media_id": best_media_id,
                "similarity": round(best_similarity, 4),
                "bucket": bucket_for(best_similarity),
            }
        )

    by_bucket: dict[str, int] = {}
    for result in results:
        by_bucket[result["bucket"]] = by_bucket.get(result["bucket"], 0) + 1
    print("\nBucket counts:")
    for bucket, count in sorted(by_bucket.items()):
        print(f"  {bucket}: {count}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nWrote {len(results)} result(s) to {OUTPUT_PATH}")
    print("Next: bun run scripts/retired/media/review-perceptual-matches.ts")


if __name__ == "__main__":
    main()
