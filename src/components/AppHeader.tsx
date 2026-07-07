/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dispatch, SetStateAction } from 'react';
import { Moon, Sparkles, Sun } from 'lucide-react';

interface AppHeaderProps {
  theme: 'dark' | 'light';
  setTheme: Dispatch<SetStateAction<'dark' | 'light'>>;
}

export function AppHeader({ theme, setTheme }: AppHeaderProps) {
  return (
      <header id="header_section" className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-brand-orange-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-xl tracking-tight text-white">
              Neura Studio
            </span>
            <div className="flex items-center text-[11px] text-slate-500 font-mono mt-0.5">
              <span>v1.27.1</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 md:space-x-6">
          {/* THEME TOGGLER */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 text-slate-350 hover:text-white transition-all text-[11px] font-mono font-medium cursor-pointer active:scale-95"
            title={theme === 'dark' ? "Skift til lyst tema (høj kontrast)" : "Skift til mørkt tema"}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">LYST TEMA</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">MØRKT TEMA</span>
              </>
            )}
          </button>

          <div className="hidden md:flex items-center text-xs bg-slate-850 px-3 py-1.5 rounded-md border border-slate-800 text-slate-350">
            <span>Tone: Autentisk & Konkret</span>
          </div>
          <a
            href="https://www.larssohl.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-400 hover:text-orange-300 font-mono transition-colors tracking-wide"
          >
            larssohl.dk &rarr;
          </a>
        </div>
      </header>
  );
}
