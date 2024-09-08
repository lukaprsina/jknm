import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "../ui/alert-dialog";
import type { GuestAuthor } from "./authors-table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { Row } from "@tanstack/react-table";
import { useMemo } from "react";
import { api } from "~/trpc/react";

export function AuthorsTableCellButtons({ author }: { author: GuestAuthor }) {
  const rename_guest = api.author.rename_guest.useMutation();
  const delete_guests = api.author.delete_guests.useMutation();

  return (
    <div className="flex gap-1">
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <PencilIcon size={18} />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Uredi ime avtorja</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi ime avtorja</DialogTitle>
          </DialogHeader>
          <Input value={author.name} />
          <DialogFooter>
            <Button type="submit">Shrani spremembe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <TrashIcon size={18} />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Izbrišite avtorja</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbrišite avtorja</AlertDialogTitle>
          </AlertDialogHeader>
          <span>
            Ste prepričani, da želite izbrisati avtorja z imenom{" "}
            <b>{author.name}</b>?
          </span>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne zbriši</AlertDialogCancel>
            <Button type="submit">Izbriši</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AuthorsTableHeaderButtons({
  rows,
}: {
  rows: Row<GuestAuthor>[];
}) {
  const message = useMemo(() => {
    const length = rows.length;
    console.log({ length });
    if (length === 0)
      return "Najprej izberite avtorje, ki jih želite izbrisati.";

    let sklon: React.ReactNode | undefined = undefined;
    if (length === 1) {
      const name = rows[0]?.original.name;
      sklon = (
        <>
          avtorja z imenom <b>{name}</b>
        </>
      );
    } else if (length === 2) {
      sklon = <b>{length} avtorja</b>;
    } else if (length === 3 || length === 4) {
      sklon = <b>{length} avtorje</b>;
    } else {
      sklon = <b>{length} avtorjev</b>;
    }

    return <span>Ste prepričani, da želite izbrisati {sklon}?</span>;
  }, [rows]);

  return (
    <div className="flex flex-grow gap-1">
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline">
                <PlusIcon size={18} />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Dodajte avtorja</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodajte avtorja</DialogTitle>
          </DialogHeader>
          <Input />
          <DialogFooter>
            <Button type="submit">Shranite avtorja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="outline">
                <TrashIcon size={18} />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Izbrišite izbrane avtorje</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbrišite izbrane avtorje</AlertDialogTitle>
            <AlertDialogDescription></AlertDialogDescription>
          </AlertDialogHeader>
          {message}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {rows.length === 0 ? "Nazaj" : "Ne izbriši"}
            </AlertDialogCancel>
            {rows.length !== 0 && <Button type="submit">Izbriši</Button>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
