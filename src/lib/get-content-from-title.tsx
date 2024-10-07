export function get_content_from_title(title: string) {
  const content = {
    blocks: [
      {
        id: "sheNwCUP5A",
        type: "header",
        data: {
          text: title,
          level: 1,
        },
      },
    ],
  };

  return {
    title: title,
    content,
  };
}
