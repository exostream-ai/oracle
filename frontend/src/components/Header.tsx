'use client';

import { useState } from 'react';

const links = [
  { href: '/#calculator', label: 'Calculator' },
  { href: '/canvas', label: 'Canvas' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/api-docs', label: 'API' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[#262626] bg-[#0a0a0a] relative">
      <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="flex items-center">
          <span className="mono text-lg font-semibold">
            <span className="text-[#e5e5e5]">exo</span>
            <span className="text-[#06b6d4]">stream</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[#737373] hover:text-[#e5e5e5] text-sm mono"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Mobile burger button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span
            className={`block w-5 h-[1.5px] bg-[#e5e5e5] transition-transform duration-200 ${
              open ? 'translate-y-[6.5px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-5 h-[1.5px] bg-[#e5e5e5] transition-opacity duration-200 ${
              open ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block w-5 h-[1.5px] bg-[#e5e5e5] transition-transform duration-200 ${
              open ? '-translate-y-[6.5px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {open && (
        <nav className="md:hidden border-t border-[#262626] bg-[#0a0a0a]">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-[#737373] hover:text-[#e5e5e5] hover:bg-[#141414] text-sm mono border-b border-[#1a1a1a] last:border-b-0"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
