import { format } from "date-fns";

export function format_date(date: Date) {
  return date.toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function format_date_for_url(date: Date) {
  return format(date, "dd-MM-yyyy");
}
