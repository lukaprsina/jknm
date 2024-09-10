"use client";

import "./editorjs-attaches.css";

import type { RenderFn } from "editorjs-blocks-react-renderer";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Blocks from "editorjs-blocks-react-renderer";
import HTMLReactParser from "html-react-parser";
import { DotIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card";

import { gallery_store } from "~/components/gallery-store";
import { format_date } from "~/lib/format-date";
import { human_file_size } from "~/lib/human-file-size";
import type { Session } from "next-auth";
import type { EditorJSImageData } from "../../lib/editor-utils";
import {
  get_heading_from_editor,
  get_image_data_from_editor,
} from "../../lib/editor-utils";
import { cn } from "~/lib/utils";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/card-adapter";

export function EditorToReact({
  article,
  session,
}: {
  article: DraftArticleWithAuthors | PublishedArticleWithAuthors | undefined;
  session: Session | null;
}) {
  const [heading, setHeading] = useState<string | undefined>();

  const editor_data = useMemo(() => {
    if (!article?.content) return;

    const heading_info = get_heading_from_editor(article.content);

    let title = heading_info.title;
    if (heading_info.error || !title) {
      console.error("Invalid heading", heading_info);
      title = "Invalid heading";
    }

    setHeading(title);

    const image_data = get_image_data_from_editor(article.content);
    gallery_store.set.images(image_data);

    return {
      version: article.content.version ?? "unknown version",
      blocks: article.content.blocks.slice(1), // remove first heading
      time: article.content.time ?? Date.now(),
    };
  }, [article?.content]);

  if (!editor_data || !article) return;

  return (
    <Card className="pt-8">
      <CardHeader>
        <h1>{heading}</h1>
        <CardDescription className="flex items-center text-base text-foreground">
          <span>
            {/* <Authors
            // TODO
              author_names={article}
            /> */}
          </span>
          {/* {article.author_ids && article.author_ids.length !== 0 && <DotIcon />} */}
          <span> {format_date(article.created_at)}</span>
          {session && "old_id" in article && article.old_id && (
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
          gallery_store.set.default_image(data);
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
