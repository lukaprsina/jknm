"use client";

import { LogOut, RefreshCcw, SettingsIcon, UsersIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import Link from "next/link";
import React from "react";
// import { AuthorsDialog } from "./authors";
// import { useState } from "react";

export function SettingsDropdown() {
  const router = useRouter();

  // TODO: to bi moral biti dialog.
  /* const sync_duplicate_urls = api.article.sync_duplicate_urls.useMutation({
    onSuccess: (data) => {
      toaster.toast({
        title: "Uspeh",
        description: `Obstaja ${data.length} podvojenih URL-jev`,
      });
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka",
        description: error.message,
      });
    },
  }); */
  // const [authorDialogOpen, setAuthorDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <SettingsIcon size={22} className="" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Nastavitve</TooltipContent>
        </Tooltip>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Nastavitve</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            asChild /* onClick={() => setAuthorDialogOpen(true)} */
          >
            <Link href="/avtorji">
              <UsersIcon className="mr-2 h-4 w-4" />
              <span>Avtorji</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              // sync_duplicate_urls.mutate();
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" size={18} />
            <span>Popravi</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Odjava</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* <AuthorsDialog
        open={authorDialogOpen}
        onClose={() => setAuthorDialogOpen(false)}
      /> */}
    </>
  );
}

/* 
<DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Avtorji</span>
            <DropdownMenuShortcut>⇧⌘A</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Keyboard className="mr-2 h-4 w-4" />
            <span>Keyboard shortcuts</span>
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Users className="mr-2 h-4 w-4" />
            <span>Team</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserPlus className="mr-2 h-4 w-4" />
              <span>Invite users</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <Mail className="mr-2 h-4 w-4" />
                  <span>Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Message</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  <span>More...</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Team</span>
            <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Github className="mr-2 h-4 w-4" />
          <span>GitHub</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LifeBuoy className="mr-2 h-4 w-4" />
          <span>Support</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Cloud className="mr-2 h-4 w-4" />
          <span>API</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
*/
