"use client";

import { Button } from "../ui/button";
import type EditorJS from "@editorjs/editorjs";

export function NoHeadingButton({ editor }: { editor: EditorJS }) {
  return (
    <Button
      onClick={() => {
        editor.blocks.insert(
          "header",
          { text: "Neimenovana novica", level: 1 },
          undefined,
          0,
          true,
          false,
        );
      }}
    >
      Dodaj naslov
    </Button>
  );
}

export function WrongHeadingButton({
  editor,
  title,
}: {
  editor: EditorJS;
  title?: string;
}) {
  return (
    <Button
      onClick={() => {
        editor.blocks.insert(
          "header",
          { text: title ?? "Neimenovana novica", level: 1 },
          undefined,
          0,
          true,
          true,
        );
      }}
    >
      Popravi naslov
    </Button>
  );
}
