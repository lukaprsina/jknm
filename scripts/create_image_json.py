import os
from pathlib import Path
import re
from sanitize_filename import sanitize


def convert_title_to_url(dangerous_url: str) -> str:
    # Sanitize the filename
    sanitized = sanitize(dangerous_url)

    # Perform replacements
    replaced = sanitized.lower()
    replaced = re.sub(r"–", "-", replaced)
    replaced = re.sub(r"č", "c", replaced)
    replaced = re.sub(r"š", "s", replaced)
    replaced = re.sub(r"ž", "z", replaced)
    replaced = re.sub(r"[^a-zA-Z0-9\-_\s]", "", replaced)  # Remove invalid characters
    replaced = re.sub(r"_+", "_", replaced)  # Replace sequences of underscores
    replaced = replaced.strip("-_")  # Remove leading/trailing hyphens and underscores
    replaced = replaced.strip()

    # Split, trim, and filter out empty elements
    replaced_split = [s.strip() for s in re.split(r"[\s+]", replaced) if s.strip()]

    return "_".join(replaced_split)


def iterate_page(directory: Path):
    for root, _, files in os.walk(directory):
        for file in files:
            source_file = Path(root) / file
            relative_path = source_file.relative_to(directory.parent)
            destination_dir = Path("D:/copied") / relative_path.parent
            destination_dir.mkdir(parents=True, exist_ok=True)

            # Extract file name and extension
            file_stem = source_file.stem
            file_extension = source_file.suffix

            # Convert title to URL and add the extension back
            converted_name = convert_title_to_url(file_stem) + file_extension

            destination_file = destination_dir / converted_name
            destination_file.write_bytes(source_file.read_bytes())


def main():
    for entry in os.listdir(base_path):
        absolute = Path(base_path) / entry
        if os.path.isfile(absolute):
            continue
        if os.path.isdir(absolute):
            iterate_page(absolute)

        print("\n")


base_path = "C:/Users/peter/OneDrive/Desktop/(static)"

if __name__ == "__main__":
    main()
