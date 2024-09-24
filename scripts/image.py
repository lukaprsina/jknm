import os
from glob import glob
from pathlib import Path
import re
import uuid
from sanitize_filename import sanitize

def convert_title_to_url(dangerous_url: str) -> str:
    # Sanitize the filename
    sanitized = sanitize(dangerous_url)

    # Perform replacements
    replaced = sanitized.lower()
    replaced = re.sub(r'–', '-', replaced)
    replaced = re.sub(r'č', 'c', replaced)
    replaced = re.sub(r'š', 's', replaced)
    replaced = re.sub(r'ž', 'z', replaced)
    replaced = re.sub(r'[^a-zA-Z0-9\-_\s]', '', replaced)  # Remove invalid characters
    replaced = re.sub(r'_+', '_', replaced)  # Replace sequences of underscores
    replaced = replaced.strip('-_')  # Remove leading/trailing hyphens and underscores
    replaced = replaced.strip()

    # Split, trim, and filter out empty elements
    replaced_split = [s.strip() for s in re.split(r'[\s+]', replaced) if s.strip()]

    return '_'.join(replaced_split)

base_path = Path.cwd() / "src/app/(static)"

def iterate_page(directory):
    result = list(Path(directory).rglob('*.jpg'))
    print("page", directory)

    for entry in result:        
        relative = Path(entry).relative_to(directory)
        fixed_relative = str(relative).replace("\\", "/")
        name = convert_title_to_url(entry.stem)[9:]
        print(f"import {name} from \"./{fixed_relative}\"")

def main():    
    for entry in os.listdir(base_path):
        absolute = os.path.join(base_path, entry)
        if os.path.isfile(absolute):
            continue
        if os.path.isdir(absolute):
            iterate_page(absolute)

if __name__ == "__main__":
    main()