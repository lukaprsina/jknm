import { CarouselWithThumbnails } from "~/components/carousel-thumbnails";

const IMAGE_ARRAY = [
  {
    file: {
      url: "https://plus.unsplash.com/premium_photo-1668438110405-9cbe9f3700db",
    },
    caption: "A beautiful image",
  },
  {
    file: {
      url: "https://images.unsplash.com/photo-1719937051058-63705ed35502",
    },
    caption: "A beautiful image",
  },
  {
    file: {
      url: "https://images.unsplash.com/photo-1725815980441-468dc5ca0d72",
    },
    caption: "A beautiful image",
  },
];

export default function Carousel() {
  return (
    <CarouselWithThumbnails
      images={[...IMAGE_ARRAY, ...IMAGE_ARRAY, ...IMAGE_ARRAY]}
    />
  );
}
