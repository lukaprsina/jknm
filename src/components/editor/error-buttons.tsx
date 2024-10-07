"use client";

import { useContext } from "react";
import { Button } from "../ui/button";
import { EditorContext } from "./editor-context";

export function NoHeadingButton() {
  const editor_context = useContext(EditorContext);
  if (!editor_context) return null;

  return (
    <Button
      onClick={() => {
        if (!editor_context.editor) return;
        editor_context.editor.blocks.insert(
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
  const editor_context = useContext(EditorContext);
  if (!editor_context) return null;

  return (
    <Button
      onClick={() => {
        if (!editor_context.editor) return;
        editor_context.editor.blocks.insert(
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
