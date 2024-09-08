"use state";

import { useState } from "react";
import { Settings2Icon } from "lucide-react";

import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";

import { useEditor } from "~/components/editor-context";
import { SettingsForm } from "./settings-form";

export function SettingsDialog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const editor = useEditor();
  if (!editor) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              onClick={async () => {
                /* if (!editor.editor || !editor.article) return;
                const editor_content = await editor.editor.save();

                editor.update_settings_from_editor(
                  editor_content,
                  editor.article.title,
                  editor.article.url,
                ); */
              }}
              variant="ghost"
              size="icon"
            >
              <Settings2Icon />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Nastavitve</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nastavitve</DialogTitle>
          <DialogDescription>
            Spremeni naslov, določi naslovno slike, objavi ali shrani kot
            osnutek.
          </DialogDescription>
        </DialogHeader>
        <SettingsForm closeDialog={() => setDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
