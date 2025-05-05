// https://github.com/shadcn-ui/ui/pull/4421

import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "~/components/date-time-picker/new_calendar";
import { TimePickerDemo } from "~/components/date-time-picker/time-demo";
import { format_datetime_for_human } from "~/lib/format-date";

export default function DatePicker({
  date,
  setDate,
}: {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}) {
  const today = new Date();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div>
          <Button
            variant="outline"
            type="button"
            className={cn(
              "flex justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>
              {date ? format_datetime_for_human(date) : "Pick a date"}
            </span>
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(new_date) => {
            const old_date = date ?? new Date();

            if (new_date) {
              const updated_date = new Date(
                new_date.getFullYear(),
                new_date.getMonth(),
                new_date.getDate(),
                old_date.getHours(),
                old_date.getMinutes(),
                old_date.getSeconds(),
              );

              setDate(updated_date);
            }
          }}
          autoFocus
          startMonth={new Date(1999, 11)}
          endMonth={new Date(today.getFullYear(), today.getMonth(), 1)}
        />
        <div className="border-t border-border p-3">
          <TimePickerDemo setDate={(d) => setDate(d)} date={date} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
