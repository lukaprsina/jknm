"use client";

import type { OutputBlockData } from "@editorjs/editorjs";
import type { Node as ParserNode } from "node-html-parser";
import { HTMLElement as ParserHTMLElement, NodeType } from "node-html-parser";
import { decode as html_decode_entities } from "html-entities";

import { get_image_dimensions } from "./converter-server";
import type {
  FileInfo,
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

const LINK_REGEX = /[\s\p{P}]$/u;
const NM_REGEX = /\sNM(\d+)/g;

function filter_children(raw_children: ParserHTMLElement[]) {
  return raw_children.filter((raw_child) => {
    if (raw_child.nodeType === NodeType.TEXT_NODE) {
      return raw_child.text.trim() !== "";
    } else if (raw_child.nodeType === NodeType.ELEMENT_NODE) {
      return true;
    } else {
      throw new Error(
        "Unexpected comment: " + raw_children.map((c) => c.text).join(", "),
      );
    }
  });
}

export async function parse_node(
  node: ParserNode,
  blocks: OutputBlockData[],
  created_at: Date,
  articles_with_authors: ImportedArticle,
  csv_url: string,
  csv_ids: number[],
  problems: InitialProblems,
  do_dimensions: boolean,
  ids_by_dimensions: IdsByDimentionType[],
  image_info: ImageInfo,
  file_info: FileInfo[],
): Promise<void> {
  function decode(text: string | undefined): string {
    const decoded = html_decode_entities(text);
    const lower = decoded.toLowerCase();

    function test(filter: string) {
      if (lower.includes(filter)) {
        problems.superscript.push([old_id, decoded]);
        console.warn(filter, old_id);
      }
    }

    function test_ws(filter: string) {
      if (lower.includes(filter)) {
        problems.superscript_ws.push([old_id, decoded]);
        console.warn(filter, old_id);
      }
    }

    test("m2");
    test_ws("m 2");
    test("m3");
    test_ws("m 3");
    test("cm2");
    test_ws("cm 2");
    test("cm3");
    test_ws("cm 3");
    test("mm2");
    test_ws("mm 2");
    test("mm3");
    test_ws("mm 3");
    test("km2");
    test_ws("km 2");

    // console.log("replaced", replaced);

    if (NM_REGEX.test(decoded)) {
      problems.nm.push([old_id, decoded]);
    }

    return (
      decoded
        // .replaceAll(NM_REGEX, "NM $1")
        .replaceAll("<strong>", "<b>")
        .replaceAll("</strong>", "</b>")
    );
  }

  const article_url = `${csv_url}-${format_date_for_url(created_at)}`;

  const old_id = articles_with_authors.objave_id;
  if (!old_id) throw new Error("No old_id");

  if (!(node instanceof ParserHTMLElement))
    throw new Error("Not an HTMLElement");

  switch (node.tagName) {
    case "P": {
      let text = decode(node.innerHTML).trim();

      for (const p_child of node.childNodes) {
        if (p_child.nodeType == NodeType.ELEMENT_NODE) {
          if (!(p_child instanceof ParserHTMLElement))
            throw new Error("Not an HTMLElement");

          if (!p_allowed_tags.includes(p_child.tagName))
            throw new Error("Unexpected tag in p element: " + p_child.tagName);

          // handle links
          if (p_child.tagName === "A") {
            const result = LINK_REGEX.test(text);
            //text.replace(LINK_REGEX, "");
            if (result) {
              console.error(
                "Link ends with whitespace or punctuation",
                old_id,
                p_child.innerHTML,
              );

              problems.link_ends_punct_or_ws.push([old_id, p_child.innerHTML]);
            }

            const link_attr = p_child.attributes;
            if ("href" in link_attr) {
              const href = html_decode_entities(link_attr.href);
              let url: URL | undefined;

              const replace_relative_link = (relative_href: string) => {
                console.error("internal link", old_id, relative_href);
                problems.link_internal.push([old_id, relative_href]);

                const decoded_href = html_decode_entities(relative_href);
                if (decoded_href.startsWith("/si/")) {
                  // TODO: ročno popravi 10, 56, 75
                  return;
                }

                const old_path = decodeURIComponent(decoded_href.toLowerCase());
                const old_path_parts = path.parse(old_path);
                const file_name = convert_filename_to_url(old_path_parts.base);
                const fs_name = `${article_url}/${file_name}`;
                const file_href = get_s3_prefix(
                  fs_name,
                  env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
                );

                text = text.replaceAll(relative_href, file_href);
                file_info.push({ old_path: relative_href, fs_name });
              };

              try {
                url = new URL(href);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (error) {
                replace_relative_link(href);
              }

              if (url) {
                if (url.hostname.includes("jknm.si")) {
                  console.error("jknmsi link", old_id, href);
                  problems.link_jknmsi.push([old_id, href]);
                  const id_string = url.searchParams.get("id");

                  if (typeof id_string !== "string") {
                    replace_relative_link(url.pathname);
                    continue;
                    // throw new Error(`No id in jknmsi link ${href}, ${old_id}`);
                  }

                  let id_num = parseInt(id_string);

                  if (isNaN(id_num)) {
                    throw new Error(`NaN ID in jknmsi link ${href}, ${old_id}`);
                  }

                  id_num++; // 1-indexed

                  const new_index = csv_ids.findIndex((id) => id === id_num);
                  const article_link = `/novica?id=${new_index}`;
                  // console.warn("Replaced", href, article_link);
                  text = text.replaceAll(href, article_link);
                } else {
                  console.error("external link", old_id, href);
                  problems.link_external.push([old_id, href]);
                }
              }
            }
          }
        } else if (p_child.nodeType === NodeType.COMMENT_NODE) {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

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
      const div_childeren = filter_children(
        raw_children as ParserHTMLElement[],
      );

      if (div_childeren.length === 0) {
        // throw new Error("Empty div " + csv_article.id);
        console.error("Empty div", old_id, node.outerHTML);
        problems.empty_divs.push([old_id, node.outerHTML]);
        break;
      } else if (div_childeren.length === 1) {
        const child = div_childeren[0];
        if (!child) throw new Error("Child is undefined?");

        if (child.nodeType === NodeType.TEXT_NODE) {
          console.error("Just text in div", old_id);
          problems.just_text_in_div.push([old_id, child.text]);
          const text = decode(child.text).trim();
          blocks.push({ type: "paragraph", data: { text } });
          break;
        } else if (child.nodeType === NodeType.ELEMENT_NODE) {
          if (child.tagName === "P" || child.tagName === "STRONG") {
            console.error("Single tag in div", old_id, child.outerHTML);
            problems.single_in_div.push([old_id, child.outerHTML]);
            const text = decode(child.innerHTML).trim();

            const filtered_nested_childeren = filter_children(
              child.childNodes as ParserHTMLElement[],
            );
            // console.log("filtered_nested_childeren", filtered_nested_childeren);
            if(filtered_nested_childeren.length === 0) {
              console.log("child.outerHTML no children", child.outerHTML)
              break;
            }
            else if (filtered_nested_childeren.length === 1) {
              blocks.push({ type: "paragraph", data: { text } });
            } else if (filtered_nested_childeren.length === 2) {
              //   console.log("p children");
            } else {
              /*console.log(
                "filtered_nested_childeren",
                filtered_nested_childeren.map((c) => c.text),
              )*/
              throw new Error(
                "More then 3 children in image: " +
                  child.tagName +
                  " " +
                  old_id,
              );
            }
          } else {
            const possible_image = child.querySelector("img");
            if (child.tagName !== "IMG" && !possible_image) {
              console.log(
                "Unexpected tag in div element, no image",
                child.outerHTML,
                possible_image,
              );
              throw new Error(
                `Unexpected tag in div element, not image: ${child.tagName} ${old_id}`,
              );
            }
          }
        } else {
          throw new Error("Unexpected comment: " + node.text);
        }
      }

      let fs_name: string | undefined;
      let image_source: string | undefined;
      let image_name: string | undefined;
      let old_path: string | undefined;
      let already_set_src = false;

      for (const img_tag of node.querySelectorAll("img")) {
        if (img_tag.nodeType == NodeType.ELEMENT_NODE) {
          if (already_set_src)
            throw new Error("Already set source once " + old_id);

          const src_attr = img_tag.attributes.src;
          const trimmed = decode(src_attr).trim();
          if (!trimmed) throw new Error("No src attribute " + old_id);

          old_path = decodeURIComponent(trimmed.toLowerCase());
          const old_path_parts = path.parse(old_path);
          image_name = convert_filename_to_url(old_path_parts.base);
          fs_name = `${article_url}/${image_name}`;
          image_source = get_s3_prefix(
            fs_name,
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
      let image_caption = "";
      let already_set_caption = false;
      for (const p_child of node.querySelectorAll("p")) {
        if (p_child.nodeType !== NodeType.ELEMENT_NODE) {
          throw new Error(
            "Not an HTMLElement " + p_child.nodeType + " " + old_id,
          );
        }

        let current_caption = "";
        for (const p_child_child of p_child.childNodes) {
          if (p_child_child.nodeType == NodeType.TEXT_NODE) {
            if (p_child_child.text.trim() !== "")
              current_caption += decode(p_child_child.text);
          } else if (p_child_child.nodeType == NodeType.ELEMENT_NODE) {
            if (!(p_child_child instanceof ParserHTMLElement))
              throw new Error("Not an HTMLElement");

            if (p_child_child.tagName === "IMG") {
              console.error(
                "Image in caption",
                old_id,
                p_child_child.outerHTML,
              );
              problems.image_in_caption.push([old_id, p_child_child.outerHTML]);
              continue;
            }

            if (!caption_allowed_tags.includes(p_child_child.tagName)) {
              throw new Error(
                "Unexpected tag in caption element: " + p_child_child.tagName,
              );
            }

            current_caption += decode(p_child_child.outerHTML);
          } else {
            throw new Error("Unexpected comment: " + node.text);
          }
        }

        const trimmed = current_caption.trim();
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
        }
      }
      // console.log("p children done");
      /*console.log("IMAGE", {
        image_source,
        image_caption,
      });*/

      if (!fs_name || !old_path || !image_name || !image_source) {
        console.log("No image src", {
          old_id,
          fs_name,
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
        fs_name,
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

        // console.log(old_id, ids_by_dimensions);
      }

      if (dimensions) {
        image_info.images.push(dimensions);
      } else {
        console.error("No dimensions for image", old_id, fs_name);
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
      throw new Error("Unexpected element: " + node.tagName + " " + old_id + " " + node.outerHTML);
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
