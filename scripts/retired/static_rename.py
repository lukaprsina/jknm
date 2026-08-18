import os
import shutil
from image import convert_title_to_url
from pathlib import Path


def convert_title(dangerous_url: str) -> str:
    # Placeholder for the actual conversion logic
    return dangerous_url.replace(" ", "_").lower()


def copy_and_rename_images(base_path: str, new_path: str, convert_title: callable):
    base_path = Path(base_path).resolve()
    new_path = Path(new_path).resolve()

    # Walk through all directories and files in base_path
    for root, dirs, files in os.walk(base_path):
        root_path = Path(root).resolve()
        relative_root = root_path.relative_to(base_path)

        # Rename the current directory
        new_relative_root = Path(*[convert_title(part) for part in relative_root.parts])
        new_root_path = new_path / new_relative_root

        # Ensure the new directory exists
        new_root_path.mkdir(parents=True, exist_ok=True)

        # Process files in the current directory
        for file_name in files:
            file_path = root_path / file_name

            # Extract extension and rename file
            file_stem, file_ext = os.path.splitext(file_name)
            new_file_stem = convert_title(file_stem)
            new_file_name = f"{new_file_stem}{file_ext}"

            new_file_path = new_root_path / new_file_name

            # Copy the file to the new location
            shutil.copy2(file_path, new_file_path)


# Main execution example
if __name__ == "__main__":
    # Example usage
    base_path = "C:/Users/peter/Downloads/(static)"
    new_path = "C:/Users/peter/Downloads/(static)_renamed"

    copy_and_rename_images(base_path, new_path, convert_title_to_url)
