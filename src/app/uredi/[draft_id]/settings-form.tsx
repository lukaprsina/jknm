"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@acme/ui/button";
import { DateTimePicker } from "@acme/ui/date-time-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@acme/ui/form";

import { useEditor } from "~/components/editor-context";
import { revalidate_next_tag } from "~/server/revalidate-next-tag";
import { editor_store } from "./editor-store";
import { ImageCarousel } from "./image-carousel";

export const form_schema = z.object({
  /* TODO: message to all zod fields
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }), */
  created_at: z.date(),
  preview_image: z.string().optional(),
});

export function SettingsForm({ closeDialog }: { closeDialog: () => void }) {
  const editor = useEditor();
  // const preview_image = editor_store.use.preview_image();

  const form = useForm<z.infer<typeof form_schema>>({
    resolver: zodResolver(form_schema),
    defaultValues: {
      preview_image: editor_store.get.preview_image() ?? undefined,
      created_at: editor?.article?.created_at,
    },
  });

  if (!editor) return null;

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          defaultValue={editor_store.get.preview_image()}
          name="preview_image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Naslovna slika</FormLabel>
              <FormDescription>
                Izberite naslovno sliko za novičko.
              </FormDescription>
              <FormControl>
                <ImageCarousel
                  onImageUrlChange={(value) => {
                    console.log("onImageUrlChange", value);
                    field.onChange(value);
                    editor_store.set.preview_image(value);
                  }}
                  imageUrl={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="created_at"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Čas objave</FormLabel>
              <FormControl>
                <DateTimePicker {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-6 flex flex-col gap-4">
          <Button
            onClick={form.handleSubmit(
              async (values: z.infer<typeof form_schema>) => {
                if (!editor.article?.id) {
                  console.error("Article ID is missing.");
                  return;
                }

                const editor_content =
                  await editor.configure_article_before_publish();

                console.log(
                  "WWWWWWWWWWWWWWW",
                  editor_store.get.google_ids(),
                  editor_store.get.custom_author_names(),
                );

                editor.mutations.publish({
                  id: editor.article.id,
                  created_at: values.created_at,
                  title: editor_store.get.title(),
                  url: editor_store.get.url(),
                  preview_image: editor_store.get.preview_image() ?? "",
                  content: editor_content,
                  author_ids: editor_store.get.google_ids(),
                  custom_author_names: editor_store.get.custom_author_names(),
                });

                closeDialog();
              },
            )}
            variant="secondary"
          >
            Objavi spremembe
          </Button>
          <Button
            onClick={async () => await revalidate_next_tag("get_users")}
            variant="secondary"
          >
            Osveži seznam avtorjev
          </Button>
          {editor.article?.published ? (
            <Button
              onClick={form.handleSubmit((_: z.infer<typeof form_schema>) => {
                if (!editor.article?.id) {
                  console.error("Article ID is missing.");
                  return;
                }

                editor.mutations.unpublish({
                  id: editor.article.id,
                });

                closeDialog();
              })}
              variant="secondary"
            >
              Skrij novičko
            </Button>
          ) : null}
          <Button
            onClick={form.handleSubmit((_: z.infer<typeof form_schema>) => {
              if (!editor.article?.id) {
                console.error("Article ID is missing.");
                return;
              }

              editor.mutations.delete_by_id(editor.article.id);

              closeDialog();
            })}
            variant="destructive"
          >
            Zbriši novičko
          </Button>
          <hr />
          <Button
            onClick={form.handleSubmit(
              async (values: z.infer<typeof form_schema>) => {
                if (!editor.article?.id) {
                  console.error("Article ID is missing.");
                  return;
                }

                const editor_content = await editor.editor?.save();

                editor.mutations.save_draft({
                  id: editor.article.id,
                  draft_content: editor_content,
                  draft_preview_image: values.preview_image ?? "",
                });

                closeDialog();
              },
            )}
          >
            Shrani osnutek
          </Button>
        </div>
      </form>
    </Form>
  );
}
