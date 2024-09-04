"use client";

import "./editorjs-attaches.css";

import type { RenderFn } from "editorjs-blocks-react-renderer";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Blocks from "editorjs-blocks-react-renderer";
import HTMLReactParser from "html-react-parser";
import { DotIcon } from "lucide-react";

import type { Session } from "@acme/auth";
import type { Article } from "@acme/db/schema";
import { cn } from "@acme/ui";
import { Card, CardContent, CardDescription, CardHeader } from "@acme/ui/card";

import type { EditorJSImageData } from "./plugins";
import { useGalleryStore } from "~/app/novica/[novica_ime]/gallery-zustand";
import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "~/app/uredi/[novica_ime]/editor-utils";
import { Authors, get_author_names } from "~/components/authors";
import { format_date } from "~/lib/format-date";
import { api } from "~/trpc/react";
import { human_file_size } from "./../lib/human-file-size";

export function EditorToReact({
  article,
  draft,
  session,
}: {
  article?: typeof Article.$inferSelect;
  draft?: boolean;
  session?: Session;
}) {
  const [heading, setHeading] = useState<string | undefined>();
  const gallery_set_images = useGalleryStore((state) => state.set_images);
  const all_authors = api.article.google_users.useQuery();

  const editor_data = useMemo(() => {
    const content = draft ? article?.draft_content : article?.content;
    if (!content) return undefined;

    const heading_info = get_heading_from_editor(content);

    if (heading_info.error || !heading_info.title) {
      console.error("Invalid heading", heading_info);
      return;
    }

    setHeading(heading_info.title);

    const image_data = get_image_data_from_editor(content);
    gallery_set_images(image_data);

    return {
      version: content.version ?? "unknown version",
      blocks: content.blocks.slice(1), // remove first heading
      time: content.time ?? Date.now(),
    };
  }, [article?.content, article?.draft_content, draft, gallery_set_images]);

  useEffect(() => {
    console.log(
      "editor-to-react author ids",
      article?.author_ids,
      article?.author_ids && article.author_ids.length !== 0,
    );
  }, [article?.author_ids]);

  if (!editor_data || !article) return;

  return (
    <Card className="pt-8">
      <CardHeader>
        <h1>{heading}</h1>
        <CardDescription className="flex items-center text-base text-foreground">
          <span>
            <Authors
              author_names={get_author_names(article, all_authors.data)}
            />
          </span>
          {article.author_ids && article.author_ids.length !== 0 && <DotIcon />}
          <span> {format_date(article.created_at)}</span>
          {session && article.old_id && (
            <>
              <DotIcon />
              {article.old_id}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Blocks
          data={editor_data}
          renderers={{
            image: NextImageRenderer,
            attaches: AttachesRenderer,
          }}
        />
      </CardContent>
    </Card>
  );
}

const DOUBLE_IMAGES = false as boolean;

export const NextImageRenderer: RenderFn<EditorJSImageData> = ({
  data,
  className,
}) => {
  const gallery = useGalleryStore();

  const image_props = useMemo(() => {
    if (!data.file.width || !data.file.height)
      return { width: 1500, height: 1000, dimensions_exist: false };

    if (DOUBLE_IMAGES && data.file.width < 500 && data.file.height < 500) {
      return {
        width: data.file.width * 2,
        height: data.file.height * 2,
        dimensions_exist: true,
      };
    } else {
      return {
        width: data.file.width,
        height: data.file.height,
        dimensions_exist: true,
      };
    }
  }, [data.file.height, data.file.width]);

  /* useEffect(() => {
    console.log(data, image_props);
  }, [data, image_props]); */

  return (
    <figure className="max-h-[1500] max-w-[1500]">
      <Image
        loader={({ src }) => src}
        onClick={() => {
          // router.push(`?image=${data.file.url}`);
          // gallery_store.set.default_image(data);
          gallery.set_default_image(data);
        }}
        /* onMouseDown={() => {
          gallery.set_default_image(data);
        }}
        onPointerDown={() => {
          gallery.set_default_image(data);
        }} */
        className={cn(
          "cursor-pointer",
          className,
          !image_props.dimensions_exist && "object-contain",
        )}
        src={data.file.url}
        alt={data.caption}
        width={image_props.width}
        height={image_props.height}
        priority={true}
        // fill={!image_props?.dimensions_exist}
      />
      <figcaption>{HTMLReactParser(data.caption)}</figcaption>
    </figure>
  );
};

interface EditorJSAttachesData {
  file: {
    url: string;
    size: number;
    name: string;
    extension?: string;
  };
  title: string;
}

const EXTENSION_MAX_LENGTH = 4;

export const AttachesRenderer: RenderFn<EditorJSAttachesData> = ({
  data,
  className,
}) => {
  const extension = useMemo(() => {
    if (!data.file.extension) return "";
    let visible_extension = data.file.extension.trim().toUpperCase();

    if (data.file.extension.length > EXTENSION_MAX_LENGTH) {
      visible_extension = extension.substring(0, EXTENSION_MAX_LENGTH) + "…";
    }

    return visible_extension;
  }, [data.file.extension]);

  const backgroundColor = useMemo(() => {
    const ext = data.file.extension;
    if (!ext) return "#333";
    return _EXTENSIONS[ext] ?? "#333";
  }, [data.file.extension]);

  return (
    <Link
      className={cn(className, "cdx-attaches cdx-attaches--with-file")}
      href={data.file.url}
      target="_blank"
    >
      <div className="cdx-attaches__file-icon">
        <div
          className="cdx-attaches__file-icon-background"
          style={{ backgroundColor }}
        ></div>
        <div
          className="cdx-attaches__file-icon-label"
          title="json"
          style={{ backgroundColor }}
        >
          {extension}
        </div>
      </div>
      <div className="cdx-attaches__file-info">
        <div className="cdx-attaches__title">{data.title}</div>
        <div className="cdx-attaches__size">
          {human_file_size(data.file.size)}
        </div>
      </div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2}
          d="M7 10L11.8586 14.8586C11.9367 14.9367 12.0633 14.9367 12.1414 14.8586L17 10"
        ></path>
      </svg>
    </Link>
  );
};

// https://github.com/editor-js/attaches
const _EXTENSIONS: Record<string, string> = {
  doc: "#1483E9",
  docx: "#1483E9",
  odt: "#1483E9",
  pdf: "#DB2F2F",
  rtf: "#744FDC",
  tex: "#5a5a5b",
  txt: "#5a5a5b",
  pptx: "#E35200",
  ppt: "#E35200",
  mp3: "#eab456",
  mp4: "#f676a6",
  xls: "#11AE3D",
  html: "#2988f0",
  htm: "#2988f0",
  png: "#AA2284",
  jpg: "#D13359",
  jpeg: "#D13359",
  gif: "#f6af76",
  zip: "#4f566f",
  rar: "#4f566f",
  exe: "#e26f6f",
  svg: "#bf5252",
  key: "#00B2FF",
  sketch: "#FFC700",
  ai: "#FB601D",
  psd: "#388ae5",
  dmg: "#e26f6f",
  json: "#2988f0",
  csv: "#11AE3D",
};
