"use client";

import { Button } from "../ui/button";
import type EditorJS from "@editorjs/editorjs";

export function NoHeadingButton() {
  return (
    <Button
      onClick={() => {
        editor_context.blocks.insert(
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

export function WrongHeadingButton({ title }: { title?: string }) {
  return (
    <Button
      onClick={() => {
        editor_context.blocks.insert(
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
