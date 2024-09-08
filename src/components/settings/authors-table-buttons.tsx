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

export function AuthorsTableCellButtons({ author }: { author: GuestAuthor }) {
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
            <AlertDialogDescription>
              Ste prepričani, da želite zbrisati avtorja z imenom{" "}
              <strong>{author.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne zbriši</AlertDialogCancel>
            <Button type="submit">Izbriši</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AuthorsTableHeaderButtons() {
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
          <AlertDialogContent>
            Ste prepričani, da želite izbrisati izbrane avtorje?
          </AlertDialogContent>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne zbriši</AlertDialogCancel>
            <Button type="submit">Izbriši</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
