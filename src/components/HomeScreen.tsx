import React from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, ClipboardList, FileImage, Download } from 'lucide-react';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh w-full flex-col font-sans" style={{ backgroundColor: '#faf9f5' }}>
      {/* Header */}
      <header className="flex w-full items-center justify-between px-6 py-4 lg:px-12 lg:py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Map My Block Logo" className="h-10 w-auto object-contain" />
          <h1 className="text-xl font-medium tracking-tight text-[#212121]">Map My Block</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden text-sm font-semibold text-gray-800 hover:text-black md:block">Log in</button>
          <button className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-800">
            മലയാളം
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-between px-6 py-8 lg:flex-row lg:items-start lg:px-12 lg:py-16">
        
        {/* Left Column (Text & CTA) */}
        <div className="flex w-full flex-col items-center lg:items-start lg:w-[45%] lg:pr-8">
          
          {/* Typography */}
          <h2 className="mb-6 text-center text-[2.5rem] leading-[1.1] text-[#111] lg:text-left lg:text-[4rem] lg:leading-[1.1]" style={{ fontFamily: 'Georgia, serif' }}>
            HLB MAP Generator<br />
            for Census 2027
          </h2>
          
          <p className="mb-8 text-center text-lg leading-relaxed text-gray-700 lg:text-left lg:text-xl lg:max-w-[85%]">
            MapMyBlock generates HLB map A4 size . You'll never need to "draw manually" again.
          </p>
          
          {/* Button */}
          <button
            onClick={() => router.push('/upload')}
            className="mb-12 flex items-center justify-center gap-2 rounded-full bg-black px-8 py-4 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 lg:px-10 lg:text-base"
          >
            <PlayCircle size={20} className="fill-white text-black" />
            Get started for free
          </button>

          {/* Features List */}
          <div className="flex flex-col gap-6 text-sm font-medium text-gray-800 lg:text-base">
            <div className="flex items-center gap-4">
              <ClipboardList size={22} className="text-gray-700 stroke-[1.5]" />
              <span>copy paste your sms and get your places</span>
            </div>
            
            <div className="flex items-center gap-4">
              <FileImage size={22} className="text-gray-700 stroke-[1.5]" />
              <span>upload images or pdf and get then in handwritten format</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Download size={22} className="text-gray-700 stroke-[1.5]" />
              <div className="flex items-center gap-2">
                <span>download A4 size</span>
                {/* Simulated PDF icon */}
                <div className="flex h-5 items-center justify-center rounded-[3px] border border-red-500 px-1 text-[9px] font-bold text-red-500">
                  PDF
                </div>
                {/* India Flag Emoji */}
                <span className="text-lg leading-none">🇮🇳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Hero Image) */}
        <div className="mt-16 flex w-full items-center justify-center lg:mt-0 lg:w-[50%] lg:justify-end">
          <div className="relative w-full max-w-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <img 
              src="/hero-image.png" 
              alt="Map My Block Interface" 
              className="h-auto w-full object-cover"
            />
          </div>
        </div>

      </main>
    </div>
  );
}
