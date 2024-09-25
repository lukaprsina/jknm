'use client'

import Link from "next/link"

export function FooterComponent() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between space-y-8 md:space-y-0 md:space-x-8">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-4">Company</h2>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-gray-300">About Us</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Careers</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Press</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Blog</Link></li>
            </ul>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-4">Products</h2>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-gray-300">Features</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Pricing</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Security</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Enterprise</Link></li>
            </ul>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-4">Resources</h2>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-gray-300">Documentation</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Tutorials</Link></li>
              <li><Link href="#" className="hover:text-gray-300">Support</Link></li>
              <li><Link href="#" className="hover:text-gray-300">API Reference</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
          <p>&copy; 2023 Your Company Name. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}