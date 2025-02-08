import React from "react";
import { Shell } from "~/components/shell";

export default function KontaktPage() {
  return (
    <Shell>
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2780.878072740336!2d15.17148101237302!3d45.81370020993017!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4765001cb4a38a57%3A0xc99d5cf17a45c4f8!2sSeidlova%20cesta%2029%2C%208000%20Novo%20mesto!5e0!3m2!1sen!2ssi!4v1739015680434!5m2!1sen!2ssi"
        width="600"
        height="450"
        className="border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      ></iframe>
    </Shell>
  );
}
