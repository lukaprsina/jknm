import os
from glob import glob
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


base_path = Path.cwd() / "src/app/(static)"

sorted_dirs = [
    "01 Kataster jam",
    "02 Izobraževanje",
    "03 Etični kodeks",
    "04 Društvo v javnem interesu",
    "05 Jamarska reševalna služba",
]


def iterate_page_subdir(directory: Path):
    imports = []

    files = os.listdir(directory)
    for entry in files:
        absolute = directory / entry
        relative = absolute.relative_to(directory.parent)
        stem = absolute.stem[9:]
        name = convert_title_to_url(stem)

        slug = name
        index = 1
        while any(slug == existing_name for existing_name, _, _ in imports):
            slug = f"{name}_{index}"
            index += 1

        fixed_relative = str(relative).replace("\\", "/")
        imports.append((slug, fixed_relative, stem))

    return imports


def iterate_page(directory: Path):
    print(f"page {directory}: {sorted_dirs}")

    for test in sorted_dirs:
        test = directory / test
        if os.path.isdir(test):
            print("subdir", test)
            imports_set = iterate_page_subdir(test)

            for slug, relative, stem in imports_set:
                print(f'import {slug} from "./{relative}"')

            print()

            for slug, relative, stem in imports_set:
                print(f'<Image src={{{slug}}} alt="{stem}" caption="" />')

            input()
            print()
            print()
            print()
        else:
            print(f"missing {test}")
    print(f"done with {directory}")


def iterate_page_one_dir(directory: Path):
    print(f"page {directory}: {sorted_dirs}")

    if os.path.isdir(directory):
        print("subdir", directory)
        imports_set = iterate_page_subdir(directory)

        for slug, relative, stem in imports_set:
            print(f'import {slug} from "./{relative}"')

        print()

        for slug, relative, stem in imports_set:
            print(f'<Image src={{{slug}}} alt="{stem}" caption="" />')

        input()
        print()
        print()
        print()
    else:
        print(f"missing {directory}")
    print(f"done with {directory}")


def main():
    iterate_page(Path(base_path) / "klub")
    """ for entry in os.listdir(base_path):
        absolute = os.path.join(base_path, entry)
        if os.path.isfile(absolute):
            continue
        if os.path.isdir(absolute):
            iterate_page(absolute) """


if __name__ == "__main__":
    main()
