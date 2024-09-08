"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import React from "react";
import { AuthorsDataTable } from "./authors-table";

export function AuthorsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent /* className="max-w-[min(1500px,_90vw)]" */>
        <DialogHeader>
          <DialogTitle>Uredi avtorje</DialogTitle>
          <DialogDescription>
            Urejate lahko samo gostujoče avtorje, ki niso dodani v Google Admin.
          </DialogDescription>
        </DialogHeader>
        <AuthorsDataTable />
        <DialogFooter>
          <Button type="submit">Shrani spremembe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
