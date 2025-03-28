"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

export const contact_form_schema = z.object({
  email: z.string(),
  name: z.string(),
  address: z.string().optional(),
  message: z.string(),
});

export default function ContactForm() {
  const form = useForm<z.infer<typeof contact_form_schema>>({
    resolver: zodResolver(contact_form_schema),
    defaultValues: {
      email: "",
      name: "",
      address: "",
      message: "",
    },
  });

  async function onSubmit(values: z.infer<typeof contact_form_schema>) {
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        console.error(
          "Failed to send message",
          response.statusText,
          await response.json(),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-3xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:space-x-4">
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-pošta</FormLabel>
                  <FormControl>
                    <Input placeholder="" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ime in priimek</FormLabel>
                  <FormControl>
                    <Input placeholder="" type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kraj/mesto</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="address-level2"
                      placeholder=""
                      type=""
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mb-8 flex-1 flex-shrink-0">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="h-full w-full">
                  <FormLabel>Sporočilo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder=""
                      className="h-full w-full resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <Button type="submit">Pošlji sporočilo</Button>
      </form>
    </Form>
  );
}
