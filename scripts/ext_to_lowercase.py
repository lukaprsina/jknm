import os
from pathlib import Path

base_path = Path.cwd() / "src/app/(static)"


def rename_extensions_to_lowercase(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            file_name, file_extension = os.path.splitext(file)

            # If the extension contains uppercase letters
            if file_extension != file_extension.lower():
                new_file_path = os.path.join(root, file_name + file_extension.lower())

                # Rename the file
                os.rename(file_path, new_file_path)
                print(f"Renamed: {file_path} -> {new_file_path}")


if __name__ == "__main__":
    rename_extensions_to_lowercase(base_path)
