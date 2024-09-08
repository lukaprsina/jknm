"use client";

import { Input } from "~/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/components/ui/form";
import type { GuestAuthor } from "./table";
import { api } from "~/trpc/react";
import { DialogClose, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export const edit_form_schema = z.object({
  name: z.string().min(1).max(255),
});

export function EditAuthorNameForm({
  author,
  close_dialog: close_dialog,
}: {
  author: GuestAuthor;
  close_dialog: () => void;
}) {
  const rename_guest = api.author.rename_guest.useMutation();
  const trpc_utils = api.useUtils();

  const form = useForm<z.infer<typeof edit_form_schema>>({
    resolver: zodResolver(edit_form_schema),
    defaultValues: {
      name: author.name,
    },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async () => {
          rename_guest.mutate({
            id: author.id,
            name: form.getValues("name"),
          });
          await trpc_utils.author.invalidate();

          close_dialog();
        })}
      >
        <span>
          Staro ime in priimek: <b>{author.name}</b>, ID: <b>{author.id}</b>
        </span>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Novo ime</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <DialogClose>Prekliči</DialogClose>
          <DialogClose asChild>
            <Button type="submit">Preimenuj</Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </Form>
  );
}

export const insert_form_schema = z.object({
  name: z.string().min(1).max(255),
});

export function InsertAuthorForm() {
  const insert_guest = api.author.insert_guest.useMutation();
  const trpc_utils = api.useUtils();

  const form = useForm<z.infer<typeof insert_form_schema>>({
    resolver: zodResolver(insert_form_schema),
    defaultValues: {
      name: "",
    },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async () => {
          insert_guest.mutate(form.getValues("name"));
          await trpc_utils.author.invalidate();
        })}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Ime in priimek</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <DialogClose>Prekliči</DialogClose>
          <DialogClose asChild>
            <Button type="submit">Dodaj</Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </Form>
  );
}
