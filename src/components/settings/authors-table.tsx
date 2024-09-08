"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useAllAuthors } from "../authors";
import { ScrollArea } from "../ui/scroll-area";
import { EditIcon } from "lucide-react";

export function AuthorsTable() {
  const authors = useAllAuthors();

  if (!authors) return null;

  return (
    <ScrollArea className="max-h-[60vh] w-auto rounded-md border">
      <Table>
        {/* <TableCaption>A list of your recent invoices.</TableCaption> */}
        <TableHeader className="sticky top-0 bg-secondary">
          <TableRow>
            <TableHead /* className="w-[100px]" */>Ime</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="flex-grow text-right">Uredi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-h-[60vh]">
          {authors.map((author) => (
            <TableRow key={author.id}>
              <TableCell className="font-medium">{author.name}</TableCell>
              <TableCell>{author.email}</TableCell>
              <TableCell className="text-right">
                <EditIcon size={18} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {/* <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow>
        </TableFooter> */}
      </Table>
    </ScrollArea>
  );
}
