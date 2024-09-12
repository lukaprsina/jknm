"use state";

import { useContext, useState } from "react";
import { Settings2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { SettingsForm } from "./settings-form";
import { EditorContext } from "~/components/editor/editor-context";
import { ScrollArea } from "~/components/ui/scroll-area";

export function SettingsDialog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const editor_context = useContext(EditorContext);
  if (!editor_context) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              onClick={async () => {
                /* if (!editor_context.editor || !editor_context.article) return;
                const editor_content = await editor_context.editor_context.save();

                editor_context.update_settings_from_editor(
                  editor_content,
                  editor_context.article.title,
                  editor_context.article.url,
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
      {/* sm:max-w-[425px] */}
      <DialogContent className="max-h-[90vh] max-w-[70vw]">
        <DialogHeader>
          <DialogTitle>Nastavitve</DialogTitle>
          <DialogDescription>
            Določi naslovno sliko in čas objave.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <SettingsForm closeDialog={() => setDialogOpen(false)} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
