"use client";

import type { OutputBlockData } from "@editorjs/editorjs";
import type { Node as ParserNode } from "node-html-parser";
import { decode } from "html-entities";
import { NodeType, HTMLElement as ParserHTMLElement } from "node-html-parser";

import type { CSVType } from "./converter-server";
import { get_image_dimensions } from "./converter-server";

const p_allowed_tags = ["STRONG", "BR", "A", "IMG", "EM", "SUB", "SUP"];
const caption_allowed_tags = ["STRONG", "EM", "A", "SUB", "SUP"];

export async function parse_node(
  node: ParserNode,
  blocks: OutputBlockData[],
  csv_article: CSVType,
  csv_url: string,
  article_id: number,
  problems: Record<string, [string, string][]>,
): Promise<boolean> {
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
          console.error("No video id", csv_article.id, src);
          return false;
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

        console.log("Video", csv_article.id, src ?? "NO SRC");

        problems.videos?.push([csv_article.id, src ?? "NO SRC"]);
        return false;
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
        console.error("Empty div", csv_article.id, node.outerHTML);
        // problems.empty_divs?.push([csv_article.id, node.outerHTML]);
        break;
      } else if (children.length === 1) {
        const child = children[0];
        if (!child) throw new Error("Child is undefined?");

        if (child.nodeType === NodeType.TEXT_NODE) {
          console.error("Single text in div", csv_article.id);
          problems.single_in_div?.push([csv_article.id, child.text]);
          const text = decode(child.text).trim();
          blocks.push({ type: "paragraph", data: { text } });
          break;
        } else if (child.nodeType === NodeType.ELEMENT_NODE) {
          if (!(child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (child.tagName === "P" || child.tagName === "STRONG") {
            console.error("Single tag in div", csv_article.id, child.outerHTML);
            problems.single_in_div?.push([csv_article.id, child.outerHTML]);
            const text = decode(child.innerHTML).trim();
            blocks.push({ type: "paragraph", data: { text } });
            break;
          } else if (child.tagName !== "IMG") {
            throw new Error(
              "Unexpected element in div: " +
                csv_article.id +
                ", " +
                child.outerHTML,
            );
          }
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      let src: string | undefined;
      let already_set_src = false;

      for (const img_tag of node.querySelectorAll("img")) {
        if (img_tag.nodeType == NodeType.ELEMENT_NODE) {
          if (!(img_tag instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (already_set_src)
            throw new Error("Already set source once " + csv_article.id);

          const src_attr = img_tag.attributes.src;
          const trimmed = decode(src_attr).trim();
          if (!trimmed) throw new Error("No src attribute " + csv_article.id);

          const src_parts = trimmed.trim().split("/");
          const image_name = src_parts[src_parts.length - 1];
          src = `${AWS_PREFIX}/${csv_url}-${article_id}/${image_name}`;
          /* console.log("Image", csv_article.id, {
            src,
            src_parts,
            src_attr,
            already_set_src,
          }); */
          already_set_src = true;
        } else if (img_tag.nodeType == NodeType.TEXT_NODE) {
          // console.error("Image is just text: " + csv_article.id);
          throw new Error("Image is just text: " + csv_article.id);
          // if (img_tag.text.trim() !== "")
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      // console.log("p children");
      let caption: string | undefined;
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
                  csv_article.id,
                  p_child_child.outerHTML,
                );
                problems.image_in_caption?.push([
                  csv_article.id,
                  p_child_child.outerHTML,
                ]);
                continue;
              }

              if (!caption_allowed_tags.includes(p_child_child.tagName)) {
                throw new Error(
                  "Unexpected tag in caption element: " + p_child_child.tagName,
                );
                /* problems.tag_in_caption?.push([
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
              console.log({ previous: caption, current: trimmed });
              throw new Error("Already set caption once " + csv_article.id);
            }

            caption = trimmed;
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
            "Caption is just text" + csv_article.id + ", " + p_child.outerHTML,
          );
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }
      // console.log("p children done");

      if (!src) {
        throw new Error(
          "No image src " + csv_article.id + ", " + node.outerHTML,
        );
        /* console.error("No image src", csv_article.id);
        return false; */
      }

      if (!caption) {
        // throw new Error("No caption " + csv_article.id);
        console.error("No image caption", csv_article.id, node.outerHTML);
        problems.empty_captions?.push([csv_article.id, node.outerHTML]);
        caption = "";
        // return false;
      }

      // console.log({ src, caption });
      // TODO: get image dimensions
      const dimensions = await get_image_dimensions(src);
      if (!dimensions) {
        console.error("No dimensions for image", csv_article.id, src);
        break;
      }

      // console.log("Image", csv_article.id, { src, caption });
      blocks.push({
        type: "image",
        data: {
          file: {
            url: src,
            width: dimensions.width,
            height: dimensions.height,
          },
          caption,
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
  return false;
}

function youtube_url_to_id(url?: string) {
  if (!url) return false;
  const youtube_regex =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = youtube_regex.exec(url);

  return match && match[7]?.length == 11 ? match[7] : false;
}

const AWS_PREFIX =
  "https://jamarski-klub-novo-mesto.s3.eu-central-1.amazonaws.com";
/* const AWS_PREFIX =
  "https://jknm.s3.eu-central-1.amazonaws.com"; */
