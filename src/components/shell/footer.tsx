import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from "./icons";

export function Footer() {
  return (
    <footer className="bg-gray-900 py-12 text-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col justify-between space-y-8 md:flex-row md:space-x-8 md:space-y-0">
          <div className="flex-1">
            <h2 className="mb-4 text-xl font-bold">Vizitka</h2>
            <address className="mb-4 not-italic">
              Jamarski klub Novo mesto
              <br />
              Seidlova cesta 29
              <br />
              8000 Novo mesto
            </address>
            <div className="text-sm">
              <p>
                <strong>TRR:</strong> 02970-0020299064
              </p>
              <p>
                <strong>Davčna številka:</strong> 82533113
              </p>
              <p>Nismo zavezanci za DDV</p>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="mb-4 text-xl font-bold">Stik z nami</h2>
            <ul className="space-y-2">
              <li className="flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                <Link
                  href="mailto:info@jknm.si"
                  className="hover:text-gray-300"
                >
                  info@jknm.si
                </Link>
              </li>
              <li className="flex items-center">
                <Phone className="mr-2 h-5 w-5" />
                <Link href="tel:+38641871385" className="hover:text-gray-300">
                  +386 (0)41 871 385, Zdravko Bučar
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex-1">
            <h2 className="mb-4 text-xl font-bold">Spremljajte nas</h2>
            <div className="flex space-x-4">
              <FacebookIcon />
              <YoutubeIcon />
              <InstagramIcon />
              <TwitterIcon />
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} Jamarski klub Novo mesto. Vse
            pravice pridržane.
          </p>
        </div>
      </div>
    </footer>
  );
}
