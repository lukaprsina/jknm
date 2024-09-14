"use client";

import type { OutputBlockData } from "@editorjs/editorjs";
import type { Node as ParserNode } from "node-html-parser";
import { decode } from "html-entities";
import { NodeType, HTMLElement as ParserHTMLElement } from "node-html-parser";

import { get_image_dimensions } from "./converter-server-wtf";
import type {
  IdsByDimentionType,
  ImageInfo,
  ImportedArticle,
  InitialProblems,
} from "./converter-spaghetti";
import { convert_filename_to_url } from "~/lib/article-utils";
import path from "path";
import { format_date_for_url } from "~/lib/format-date";
import { env } from "~/env";
import { get_s3_prefix } from "~/lib/s3-publish";

const p_allowed_tags = ["STRONG", "BR", "A", "IMG", "EM", "SUB", "SUP"];
const caption_allowed_tags = ["STRONG", "EM", "A", "SUB", "SUP"];
const do_dimensions = false as boolean;

export async function parse_node(
  node: ParserNode,
  blocks: OutputBlockData[],
  created_at: Date,
  articles_with_authors: ImportedArticle,
  csv_url: string,
  problems: InitialProblems,
  ids_by_dimensions: IdsByDimentionType[],
  image_info: ImageInfo,
): Promise<void> {
  const article_url = `${csv_url}-${format_date_for_url(created_at)}`;

  const old_id = articles_with_authors.objave_id;
  if (!old_id) throw new Error("No old_id");

  if (!(node instanceof ParserHTMLElement))
    throw new Error("Not an HTMLElement");

  switch (node.tagName) {
    case "P": {
      for (const p_child of node.childNodes) {
        if (p_child.nodeType == NodeType.ELEMENT_NODE) {
          if (!(p_child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (!p_allowed_tags.includes(p_child.tagName))
            throw new Error("Unexpected tag in p element: " + p_child.tagName);
        } else if (p_child.nodeType === NodeType.COMMENT_NODE) {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      const text = decode(node.innerHTML).trim();
      blocks.push({ type: "paragraph", data: { text } });
      break;
    }
    case "DIV": {
      if (node.attributes.class?.includes("video")) {
        let param = node.querySelector('param[name="movie"]');
        let src = param?.attributes.value;

        // TODO: video caption
        let id = youtube_url_to_id(src);

        if (!id) {
          param = node.querySelector("embed");
          src = decodeURI(param?.attributes.src?.slice(2) ?? "");
          id = youtube_url_to_id(src);
        }

        if (!id) {
          param = node.querySelector("iframe");
          src = param?.attributes.src;
          id = youtube_url_to_id(src);
        }

        if (!id) {
          console.error("No video id", old_id, src);
          problems.videos_no_id.push([old_id, src ?? "NO SRC"]);
          return;
        }

        blocks.push({
          type: "embed",
          data: {
            service: "youtube",
            embed: `https://www.youtube.com/embed/${id}`,
            source: `https://www.youtube.com/watch?v=${id}`,
            width: 580,
            height: 320,
          },
        });

        console.log("Video", old_id, src ?? "NO SRC");

        problems.videos.push([old_id, src ?? "NO SRC"]);
        return;
      }

      const raw_children = node.childNodes;
      const children = raw_children.filter((raw_child) => {
        if (raw_child.nodeType === NodeType.TEXT_NODE) {
          return raw_child.text.trim() !== "";
        } else if (raw_child.nodeType === NodeType.ELEMENT_NODE) {
          return true;
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      });

      if (children.length === 0) {
        // throw new Error("Empty div " + csv_article.id);
        console.error("Empty div", old_id, node.outerHTML);
        // problems.empty_divs?.push([csv_article.id, node.outerHTML]);
        break;
      } else if (children.length === 1) {
        const child = children[0];
        if (!child) throw new Error("Child is undefined?");

        if (child.nodeType === NodeType.TEXT_NODE) {
          console.error("Single text in div", old_id);
          problems.single_in_div.push([old_id, child.text]);
          const text = decode(child.text).trim();
          blocks.push({ type: "paragraph", data: { text } });
          break;
        } else if (child.nodeType === NodeType.ELEMENT_NODE) {
          if (!(child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (child.tagName === "P" || child.tagName === "STRONG") {
            console.error("Single tag in div", old_id, child.outerHTML);
            problems.single_in_div.push([old_id, child.outerHTML]);
            const text = decode(child.innerHTML).trim();
            blocks.push({ type: "paragraph", data: { text } });
            break;
          } else if (child.tagName !== "IMG") {
            // TODO
            console.error(
              `Unexpected element in div: ${child.tagName} ${old_id}, ${child.outerHTML}`,
            );
            // problems.
          }
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      let s3_url: string | undefined;
      let image_source: string | undefined;
      let image_name: string | undefined;
      let old_path: string | undefined;
      let already_set_src = false;

      for (const img_tag of node.querySelectorAll("img")) {
        if (img_tag.nodeType == NodeType.ELEMENT_NODE) {
          if (!(img_tag instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (already_set_src)
            throw new Error("Already set source once " + old_id);

          const src_attr = img_tag.attributes.src;
          const trimmed = decode(src_attr).trim();
          if (!trimmed) throw new Error("No src attribute " + old_id);

          old_path = decodeURIComponent(trimmed.toLowerCase());
          const old_path_parts = path.parse(old_path);
          image_name = convert_filename_to_url(old_path_parts.base);
          s3_url = `${article_url}/${image_name}`;
          image_source = get_s3_prefix(
            s3_url,
            env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
          );
          already_set_src = true;
        } else if (img_tag.nodeType == NodeType.TEXT_NODE) {
          // console.error("Image is just text: " + csv_article.id);
          throw new Error("Image is just text: " + old_id);
          // if (img_tag.text.trim() !== "")
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      // console.log("p children");
      let image_caption: string | undefined;
      let already_set_caption = false;
      for (const p_child of node.querySelectorAll("p")) {
        if (p_child.nodeType == NodeType.ELEMENT_NODE) {
          if (!(p_child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          /* console.log(
            "p_child",
            p_child.tagName,
            p_child.innerHTML,
            p_child.childNodes,
          ); */

          let is_wrong = false;
          for (const p_child_child of p_child.childNodes) {
            if (p_child_child.nodeType == NodeType.ELEMENT_NODE) {
              if (!(p_child_child instanceof ParserHTMLElement))
                throw new Error("Not an HTMLElement");

              if (p_child_child.tagName === "IMG") {
                is_wrong = true;
                console.error(
                  "Image in caption",
                  old_id,
                  p_child_child.outerHTML,
                );
                problems.image_in_caption.push([
                  old_id,
                  p_child_child.outerHTML,
                ]);
                continue;
              }

              if (!caption_allowed_tags.includes(p_child_child.tagName)) {
                throw new Error(
                  "Unexpected tag in caption element: " + p_child_child.tagName,
                );
                /*problems.tag_in_caption?.push([
                  csv_article.id,
                  p_child_child.outerHTML,
                ]);
                console.error(
                  "Unexpected tag in caption element",
                  csv_article.id,
                  p_child_child.outerHTML,
                );
                is_wrong = true; */
              }
            } else if (p_child_child.nodeType === NodeType.COMMENT_NODE) {
              throw new Error("Unexpected comment: " + node.text);
            }
          }
          if (is_wrong) continue;

          const trimmed = decode(p_child.innerHTML).trim();
          if (trimmed !== "") {
            if (already_set_caption) {
              console.error({ previous: image_caption, current: trimmed });
              throw new Error("Already set caption once " + old_id);
            }

            image_caption = trimmed;
            already_set_caption = true;
          } else {
            /* console.error(
              "Empty caption: ",
              csv_article.id,
              div_child.outerHTML,
            ); */
            continue;
          }
        } else if (p_child.nodeType == NodeType.TEXT_NODE) {
          throw new Error(
            "Caption is just text" + old_id + ", " + p_child.outerHTML,
          );
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }
      // console.log("p children done");

      if (!s3_url || !old_path || !image_name || !image_source) {
        console.log("No image src", {
          old_id,
          s3_url,
          old_path,
          image_name,
          image_source,
        });
        throw new Error("No image src " + old_id + ", " + node.outerHTML);
        /* console.error("No image src", csv_article.id);
        return false; */
      }

      if (!image_caption) {
        // throw new Error("No caption " + csv_article.id);
        console.log("No image caption", old_id, node.outerHTML);
        problems.empty_captions.push([old_id, node.outerHTML]);
        image_caption = "";
        // return false;
      }

      const dimensions = await get_image_dimensions({
        s3_url,
        old_path,
        image_name,
        do_dimensions,
      });

      if (do_dimensions && dimensions) {
        const matchingDimension = ids_by_dimensions.find(
          (ids) =>
            ids.dimensions.width === dimensions.width &&
            ids.dimensions.height === dimensions.height,
        );

        if (matchingDimension) {
          matchingDimension.ids.push(old_id);
        } else {
          ids_by_dimensions.push({
            dimensions,
            ids: [old_id],
          });
        }

        console.log(old_id, ids_by_dimensions);
      }

      if (dimensions) {
        image_info.images.push(dimensions);
      } else {
        console.error("No dimensions for image", old_id, s3_url);
        break;
      }

      // console.log("Image", csv_article.id, { src, caption });
      blocks.push({
        type: "image",
        data: {
          file: {
            url: image_source,
            width: dimensions.width,
            height: dimensions.height,
          },
          caption: image_caption,
        },
      });
      break;
    }
    case "UL": {
      const items: string[] = [];

      for (const ul_child of node.childNodes) {
        if (ul_child.nodeType == NodeType.ELEMENT_NODE) {
          if (!(ul_child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (ul_child.tagName !== "LI")
            throw new Error(
              "Unexpected element in ul element: " + ul_child.tagName,
            );

          const trimmed = decode(ul_child.innerHTML).trim();
          items.push(trimmed);
        } else if (ul_child.nodeType == NodeType.TEXT_NODE) {
          if (ul_child.text.trim() !== "")
            throw new Error("Some text: " + ul_child.text);
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      blocks.push({ type: "list", data: { style: "unordered", items } });

      break;
    }
    case "BR": {
      blocks.push({ type: "delimiter", data: {} });
      // console.log(node.tagName, node.text);
      break;
    }
    case "H2":
    case "H3":
    case "H4": {
      const level = node.tagName.trim()[1];
      if (!level) throw new Error("No level in header tag");

      const trimmed = decode(node.innerHTML).trim();
      blocks.push({
        type: "header",
        data: {
          text: trimmed,
          level: parseInt(level),
        },
      });
      break;
    }
    default: {
      throw new Error("Unexpected element: " + node.tagName);
    }
  }

  // console.log(node.tagName, node.childNodes.length);
  return;
}

function youtube_url_to_id(url?: string) {
  if (!url) return false;
  const youtube_regex =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = youtube_regex.exec(url);

  return match && match[7]?.length == 11 ? match[7] : false;
}
