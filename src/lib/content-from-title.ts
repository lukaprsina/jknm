export function get_content_from_title(title?: string) {
  const new_title = title ?? "Nova novica";

  const content = {
    blocks: [
      {
        id: "sheNwCUP5A",
        type: "header",
        data: {
          text: new_title,
          level: 1,
        },
      },
    ],
  };

  return {
    title: new_title,
    content,
  };
}
