import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";

import { editor_store } from "~/components/editor/editor-store";
import { ImageSelector } from "./image-selector";
import {
  DraftArticleContext,
  PublishedArticleContext,
} from "~/components/article/context";
import { useContext } from "react";
import { useEditorMutations } from "~/hooks/use-editor-mutations";
import { thumbnail_validator } from "~/lib/validators";
import { Separator } from "~/components/ui/separator";
import DatePicker from "~/components/date-time-picker/new_date_picker";

export const form_schema = z.object({
  created_at: z.date(),
  thumbnail_crop: thumbnail_validator.optional(),
});

export function SettingsForm({ closeDialog }: { closeDialog: () => void }) {
  const draft_article = useContext(DraftArticleContext);
  const published_article = useContext(PublishedArticleContext);
  const editor_mutations = useEditorMutations();

  const form = useForm<z.infer<typeof form_schema>>({
    resolver: zodResolver(form_schema),
    defaultValues: {
      thumbnail_crop: editor_store.get.thumbnail_crop() ?? undefined,
      created_at: draft_article?.created_at,
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          name="created_at"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Čas objave</FormLabel>
              <FormControl>
                <DatePicker date={field.value} setDate={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="thumbnail_crop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Naslovna slika</FormLabel>
              <FormControl>
                <ImageSelector image={field.value} setImage={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={form.handleSubmit((_: z.infer<typeof form_schema>) => {
              editor_mutations.delete_both();
              closeDialog();
            })}
            variant="destructive"
          >
            Izbriši novičko
          </Button>
          <div className="flex items-center justify-end gap-1">
            {published_article ? (
              <>
                <Button
                  onClick={form.handleSubmit(
                    (_: z.infer<typeof form_schema>) => {
                      editor_mutations.unpublish();
                      closeDialog();
                    },
                  )}
                  variant="secondary"
                >
                  Skrij novičko
                </Button>
              </>
            ) : null}
            <Button
              onClick={form.handleSubmit(
                async (values: z.infer<typeof form_schema>) => {
                  await editor_mutations.save_draft(
                    values.created_at,
                    values.thumbnail_crop,
                  );
                  closeDialog();
                },
              )}
              variant="secondary"
            >
              Shrani kot osnutek
            </Button>
            <Button
              onClick={form.handleSubmit(
                async (values: z.infer<typeof form_schema>) => {
                  await editor_mutations.publish(
                    values.created_at,
                    values.thumbnail_crop,
                  );
                  closeDialog();
                },
              )}
            >
              Objavi spremembe
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
