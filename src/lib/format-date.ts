import { format, parse } from "date-fns";

export function format_date(date: Date) {
  return date.toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const DATE_FORMAT = "dd-MM-yyyy";

export function format_date_for_url(date: Date) {
  return format(date, DATE_FORMAT);
}

export function read_date_from_url(date_string: string) {
  return parse(date_string, DATE_FORMAT, new Date());
}
