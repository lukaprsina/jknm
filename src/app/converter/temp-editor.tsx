"use client"

import { EDITOR_JS_PLUGINS } from "~/components/editor/plugins";
import { useCallback, useEffect } from "react";
import EditorJS from "@editorjs/editorjs";

export function TempEditor({
    editorJS,
}: {
    editorJS: React.RefObject<EditorJS | null>;
}) {
    const editor_factory = useCallback(() => {
        const temp_editor = new EditorJS({
            holder: "editorjs",
            tools: EDITOR_JS_PLUGINS({ markdown: true }),
            autofocus: true,
        });

        return temp_editor;
    }, []);

    useEffect(() => {
        if (editorJS.current) return;

        const temp_editor = editor_factory();
        editorJS.current = temp_editor;
    }, [editor_factory, editorJS]);

    return <div id="editorjs" />;
}
