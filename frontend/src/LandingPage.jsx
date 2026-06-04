import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, MapPin, Bus, Route, Activity, BarChart3, Users, ExternalLink } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [pantunText, setPantunText] = useState('');
  const fullPantun = "Jalan-jalan ke Pasar Rebo, pulangnya naik JakLingko. Kalo bingung rute sama halte, mari buka WebGIS kito!";

  const playPantunSound = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop suara sebelumnya jika ada
      const utterance = new SpeechSynthesisUtterance("Jalan-jalan ke Pasar Rebo, pulangnya naik JakLingko. Kalo bingung rute sama halte, mari buka WebGIS kito!");
      utterance.lang = 'id-ID'; // Logat Indonesia
      utterance.rate = 0.9; // Agak santai
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < fullPantun.length) {
        setPantunText(fullPantun.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 45);
    return () => clearInterval(typingInterval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden relative">
      
      {/* Gigi Balang Ornament (Top) - Fixed & Rata Atas SVG */}
      <div 
        className="fixed top-0 left-0 w-full h-4 sm:h-5 z-[60] drop-shadow-lg"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='20' viewBox='0 0 60 20'%3E%3Cpolygon points='0,0 15,20 30,0' fill='%23fbbf24' /%3E%3Cpolygon points='30,0 45,20 60,0' fill='%2310b981' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'top left'
        }}
      ></div>

      {/* Navbar / Header - Full width elegan, bukan balok */}
      <nav className="fixed w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 mt-4 sm:mt-5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              {/* Exact Bajaj Logo (Thick Line Art) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-10 h-10 text-amber-400 drop-shadow-md">
                <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  {/* Body Frame */}
                  <path d="M 15 65 L 15 30 Q 15 15 30 15 L 60 15 Q 80 15 85 45 L 85 65 L 15 65 Z" />
                  {/* Diagonal Passenger Cutout */}
                  <path d="M 15 45 L 35 65" />
                  {/* Center Pillar */}
                  <path d="M 45 15 L 45 65" />
                  {/* Driver Seat */}
                  <path d="M 45 45 Q 60 45 60 65" />
                  {/* Handlebar */}
                  <path d="M 65 15 Q 90 15 90 25" />
                  {/* Front Mudguard */}
                  <path d="M 85 45 Q 100 45 100 65 L 85 65" />
                  {/* Rear Wheel */}
                  <circle cx="30" cy="75" r="10" />
                  {/* Front Wheel */}
                  <circle cx="85" cy="75" r="10" />
                </g>
              </svg>
              <span className="font-bold text-xl tracking-tight text-white">TransJakarta <span className="text-amber-400">Timur</span></span>
            </div>
            <div className="flex space-x-6 items-center">
              <a href="#fitur" className="text-slate-300 hover:text-amber-400 text-sm font-medium transition-colors hidden md:block">Andelan Kite</a>
              <a href="#cara-pakai" className="text-slate-300 hover:text-amber-400 text-sm font-medium transition-colors hidden md:block">Cara Gunainnya</a>
              <a href="#tentang" className="text-slate-300 hover:text-amber-400 text-sm font-medium transition-colors hidden md:block">Siapa Nyang Bikin</a>
              <button 
                onClick={() => navigate('/admin')}
                className="text-slate-400 hover:text-emerald-400 px-3 py-2 text-sm font-medium transition-colors"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-28 pb-32 sm:pt-36 sm:pb-40 overflow-hidden min-h-[90vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-amber-950/30 z-10" />
          
          {/* Decorative Glow */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/15 blur-[120px] rounded-full mix-blend-screen" />
          
          {/* Decorative Monas Background Watermark */}
          <div className="absolute left-[-5%] sm:left-[2%] top-[15%] sm:top-[25%] opacity-100 pointer-events-none transform -rotate-3 scale-125 sm:scale-[1.8] z-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-[300px] h-[300px] text-emerald-400 opacity-100 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              {/* Base */}
              <path fill="currentColor" d="M 20 90 L 25 80 L 75 80 L 80 90 Z" />
              <path fill="currentColor" d="M 30 80 L 30 75 L 70 75 L 70 80 Z" />
              {/* Cup */}
              <path fill="currentColor" d="M 35 75 L 45 65 L 55 65 L 65 75 Z" />
              {/* Tower */}
              <path fill="currentColor" d="M 45 65 L 48 20 L 52 20 L 55 65 Z" />
              {/* Flame base */}
              <path fill="currentColor" d="M 46 20 L 54 20 L 52 15 L 48 15 Z" />
              {/* Flame */}
              <path fill="#fbbf24" d="M 50 5 Q 55 10 52 15 L 48 15 Q 45 10 50 5 Z" className="animate-pulse" />
            </svg>
          </div>

          {/* Decorative Exact Ondel-Ondel Background Watermark */}
          <div className="absolute right-[-5%] sm:right-[2%] top-[15%] sm:top-[20%] opacity-100 pointer-events-none transform rotate-6 scale-125 sm:scale-[1.8] z-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-[300px] h-[300px] text-amber-500 opacity-100 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path strokeWidth="5" d="M 25 95 L 25 70 Q 25 60 50 60 Q 75 60 75 70 L 75 95 Q 50 100 25 95 Z" />
                  <path strokeWidth="5" d="M 35 62 L 35 85 Q 40 85 45 85 L 45 70" />
                  <path strokeWidth="2" d="M 38 65 L 38 80 M 42 68 L 42 82" />
                  <path strokeWidth="5" d="M 65 62 L 65 85 Q 60 85 55 85 L 55 70" />
                  <path strokeWidth="2" d="M 58 68 L 58 82 M 62 65 L 62 80" />
                  <path strokeWidth="1" d="M 35 80 L 55 75" />
                  <path strokeWidth="5" d="M 30 40 L 30 50 Q 30 65 50 65 Q 70 65 70 50 L 70 40 Z" />
                  <path strokeWidth="5" d="M 30 45 Q 15 40 20 55 Q 25 60 30 55" />
                  <path strokeWidth="5" d="M 70 45 Q 85 40 80 55 Q 75 60 70 55" />
                  <circle cx="40" cy="50" r="4" fill="currentColor" stroke="none" />
                  <circle cx="60" cy="50" r="4" fill="currentColor" stroke="none" />
                  <path fill="currentColor" stroke="none" d="M 35 60 Q 50 50 65 60 Q 60 55 50 55 Q 40 55 35 60 Z" />
                  <path strokeWidth="5" d="M 28 30 L 72 30 L 75 40 L 25 40 Z" />
                  <path strokeWidth="5" d="M 30 30 L 30 25 Q 35 20 40 25 Q 50 20 60 25 Q 65 20 70 25 L 70 30 Z" />
                  <path strokeWidth="2" d="M 28 35 L 72 35" />
                  <path strokeWidth="5" d="M 50 25 L 50 5" />
                  <path strokeWidth="4" d="M 45 15 L 55 15 M 45 8 L 55 8" />
                  <path strokeWidth="5" d="M 40 25 L 30 10" />
                  <path strokeWidth="4" d="M 32 20 L 40 15 M 27 12 L 35 8" />
                  <path strokeWidth="5" d="M 30 25 L 15 15" />
                  <path strokeWidth="4" d="M 25 25 L 20 18 M 18 20 L 12 12" />
                  <path strokeWidth="5" d="M 60 25 L 70 10" />
                  <path strokeWidth="4" d="M 68 20 L 60 15 M 73 12 L 65 8" />
                  <path strokeWidth="5" d="M 70 25 L 85 15" />
                  <path strokeWidth="4" d="M 75 25 L 80 18 M 82 20 L 88 12" />
                </g>
            </svg>
          </div>
          
          {/* Jakarta Skyline (Detailed Premium version with original Green Gradient) */}
          <div className="absolute bottom-0 w-full h-[350px] opacity-[0.6] z-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to top, rgba(16, 185, 129, 0.4), transparent)' }}>
            <svg viewBox="0 0 1440 350" className="absolute bottom-0 w-full h-full preserve-3d" preserveAspectRatio="none">
              
              {/* BACK LAYER: Distant Buildings (Slate) */}
              <path fill="#1e293b" d="M0,350 L0,220 H30 V350 M50,350 V180 H90 V350 M120,350 V150 H160 V350 M200,350 V190 H240 V350 M300,350 V100 H340 V350 M400,350 V160 H450 V350 M800,350 V170 H840 V350 M900,350 V120 H940 V350 M1000,350 V190 H1050 V350 M1100,350 V140 H1150 V350 M1200,350 V180 H1250 V350 M1300,350 V110 H1340 V350" />
              
              {/* MID LAYER: Wisma 46 (Fountain Pen Shape) & Light (Dark Slate) */}
              <path fill="#0f172a" d="M1000,350 V150 Q1015,100 1030,150 V350 Z"></path>
              <path fill="#10b981" d="M1012,130 L1015,110 L1018,130 Z" className="animate-pulse"></path>
              
              {/* MID LAYER: Monas Base (Dark Slate) */}
              <path fill="#0f172a" d="M680,350 L680,180 L690,180 L695,90 L705,90 L710,180 L720,180 L720,350 Z" />
              {/* MID LAYER: Monas Flame */}
              <path fill="#fbbf24" d="M695,90 Q700,60 705,90 Z" className="animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"></path>

              {/* MID LAYER: GBK Stadium */}
              <path fill="#0f172a" d="M100,350 L90,290 Q150,260 210,290 L200,350 Z"></path>

              {/* MID LAYER: Varied Skyline Buildings */}
              <path fill="#0f172a" d="M300,350 V160 L315,140 L330,160 V350 Z"></path>
              <path fill="#0f172a" d="M350,350 V200 H360 V170 H380 V200 H390 V350 Z"></path>
              <path fill="#0f172a" d="M450,350 V120 H490 V350 Z"></path>
              <path fill="#0f172a" d="M550,350 V230 H560 V200 H570 V180 H580 V200 H590 V230 H600 V350 Z"></path>
              <path fill="#0f172a" d="M780,350 V180 L800,160 L820,180 V350 Z"></path>
              <path fill="#0f172a" d="M850,350 V250 H855 V350 M845,240 L852,250 L860,240"></path> {/* Bundaran HI style */}
              <path fill="#0f172a" d="M1100,350 V160 H1120 V140 H1140 V350 Z"></path>
              <path fill="#0f172a" d="M1200,350 V200 H1240 V350 Z"></path>
              <path fill="#0f172a" d="M1300,350 V250 H1315 V200 H1335 V250 H1350 V350 Z"></path>

              {/* FRONT LAYER: Removed to avoid black gap at bottom */}
              
              {/* GLOWING WINDOWS */}
              <rect x="110" y="220" width="8" height="12" fill="#fbbf24" opacity="0.4" className="animate-pulse" />
              <rect x="125" y="240" width="8" height="12" fill="#10b981" opacity="0.3" />
              <rect x="220" y="180" width="8" height="12" fill="#fbbf24" opacity="0.5" />
              <rect x="235" y="200" width="8" height="12" fill="#10b981" opacity="0.4" />
              <rect x="465" y="150" width="10" height="15" fill="#fbbf24" opacity="0.6" className="animate-pulse" />
              <rect x="465" y="180" width="10" height="15" fill="#fbbf24" opacity="0.4" />
              <rect x="465" y="210" width="10" height="15" fill="#fbbf24" opacity="0.5" />
              <rect x="800" y="200" width="8" height="12" fill="#10b981" opacity="0.5" />
              <rect x="860" y="240" width="8" height="12" fill="#fbbf24" opacity="0.3" />
              <rect x="1115" y="190" width="10" height="15" fill="#fbbf24" opacity="0.6" className="animate-pulse" />
              <rect x="1215" y="230" width="10" height="15" fill="#10b981" opacity="0.4" />
              <rect x="1395" y="170" width="10" height="15" fill="#fbbf24" opacity="0.5" />
              
            </svg>
          </div>
        </div>
        
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-8">
          
          {/* Pantun - Clean Typography Focus */}
          <div className="w-full max-w-2xl mx-auto mb-6 cursor-pointer group" onClick={playPantunSound} title="Klik untuk mendengar suara">
            <div className="relative py-3.5 px-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm transition-all duration-500 hover:bg-slate-800/50 hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] overflow-hidden">
              {/* Aksen kutipan transparan di background */}
              <div className="absolute top-1 left-3 text-5xl text-slate-600/20 font-serif leading-none select-none">"</div>
              <div className="absolute bottom-[-0.5rem] right-3 text-5xl text-slate-600/20 font-serif leading-none select-none">"</div>
              
              <p className="relative z-10 text-sm md:text-base font-medium leading-relaxed text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 text-center tracking-wide group-hover:scale-[1.01] transition-transform duration-300">
                {pantunText}
              </p>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            <span className="block text-white mb-2">Nyok, Jelajahi Transportasi</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-amber-300">
              Jakarta Timur
            </span>
          </h1>
          
          <p className="mt-8 max-w-2xl mx-auto text-xl text-slate-300 mb-12 leading-relaxed">
            Sistem Informasi Geografis (WebGIS) modern buat bantuin Encang, Encing, Nyak, dan Babe nyari trayek angkutan umum sama halte paling deket.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => navigate('/map')}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/40 flex items-center justify-center gap-3 text-lg border border-emerald-400/50"
            >
              <Bus className="w-6 h-6" />
              Nyok, Liat Peta Sekarang!
            </button>
            <a 
              href="#fitur"
              className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md text-white font-bold rounded-full transition-all border border-slate-600 flex items-center justify-center gap-2 hover:border-slate-500"
            >
              Intip Dulu Fiturnya
            </a>
          </div>
        </div>
      </div>

      {/* Stats Section - Balik ke desain teks simple & elegan */}
      <div className="py-12 border-y border-slate-800 bg-slate-800/60 relative z-20 backdrop-blur-sm shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div className="p-4 transform hover:-translate-y-1 transition-transform">
              <div className="text-4xl font-bold text-emerald-400 mb-2">1.031+</div>
              <div className="text-sm text-slate-300 uppercase tracking-wider font-semibold">Titik Halte</div>
            </div>
            <div className="p-4 transform hover:-translate-y-1 transition-transform">
              <div className="text-4xl font-bold text-amber-400 mb-2">131+</div>
              <div className="text-sm text-slate-300 uppercase tracking-wider font-semibold">Rute Trayek</div>
            </div>
            <div className="p-4 transform hover:-translate-y-1 transition-transform">
              <div className="text-4xl font-bold text-cyan-400 mb-2">10</div>
              <div className="text-sm text-slate-300 uppercase tracking-wider font-semibold">Kecamatan</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - Bahasa Betawi */}
      <div id="fitur" className="py-24 bg-slate-900 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Fitur Andelan Dimari</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Alat canggih beneran (Analisis Spasial) buat bantuin Abang ame Mpok ngulik rute di Jaktim.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-emerald-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="bg-emerald-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-emerald-500/30">
                <Route className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pantau Jalur Trayek</h3>
              <p className="text-slate-400 leading-relaxed relative z-10">
                Liat jalur rute Mikrotrans ampe TransJakarta gampang bener. Tinggal pilih, langsung nongol di peta.
              </p>
            </div>

            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-amber-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
              <div className="bg-amber-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-amber-500/30">
                <Activity className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Halte Paling Nempel</h3>
              <p className="text-slate-400 leading-relaxed relative z-10">
                Kagak usah takut nyasar! Tinggal pencet peta buat nyari halte paling deket dari tempat lu berdiri.
              </p>
            </div>

            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-cyan-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
              <div className="bg-cyan-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-cyan-500/30">
                <BarChart3 className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Statistik Kampung</h3>
              <p className="text-slate-400 leading-relaxed relative z-10">
                Laporan komplit tiap kecamatan. Dapet info jumlah halte, trayek nyang ngeliwatin, ampe panjang jalurnya.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Use / Cara Pakenye Section */}
      <div id="cara-pakai" className="py-24 bg-slate-950 relative z-20 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Cara Pakenye Gampang Bener!</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-16">
            Kagak perlu pusing, ikutin aje 3 langkah di bawah ini, dijamin langsung paham nyari halte.
          </p>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Garis konektor untuk desktop */}
            <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-1 bg-slate-800 -translate-y-1/2 z-0"></div>
            
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-emerald-500 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Route className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="bg-emerald-500 text-slate-900 font-black text-xl w-8 h-8 rounded-full flex items-center justify-center absolute top-0 right-1/4 translate-x-2 -translate-y-2">1</div>
              <h3 className="text-xl font-bold text-white mb-2">Pilih Trayek</h3>
              <p className="text-slate-400">Pilih rute nyang mau lu naikin dari daftar trayek nyang disediain.</p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-amber-400 mb-6 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <MapPin className="w-10 h-10 text-amber-400" />
              </div>
              <div className="bg-amber-400 text-slate-900 font-black text-xl w-8 h-8 rounded-full flex items-center justify-center absolute top-0 right-1/4 translate-x-2 -translate-y-2">2</div>
              <h3 className="text-xl font-bold text-white mb-2">Cari Halte</h3>
              <p className="text-slate-400">Peta bakal nunjukin titik halte nyang paling nempel sama lokasi lu.</p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-cyan-400 mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <Bus className="w-10 h-10 text-cyan-400" />
              </div>
              <div className="bg-cyan-400 text-slate-900 font-black text-xl w-8 h-8 rounded-full flex items-center justify-center absolute top-0 right-1/4 translate-x-2 -translate-y-2">3</div>
              <h3 className="text-xl font-bold text-white mb-2">Ngacir Dah!</h3>
              <p className="text-slate-400">Udah tau rute ame haltenya? Langsung aje gas jalan ke tkp!</p>
            </div>
          </div>
        </div>
      </div>

      {/* About/Team Section - Bahasa Betawi */}
      <div id="tentang" className="py-24 bg-slate-950 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl font-bold text-white mb-12">Nyang Bikin Nih Web</h2>
          <div className="flex justify-center">
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 max-w-3xl w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-amber-400 to-cyan-500"></div>
              
              <div className="grid md:grid-cols-3 gap-6 pt-4">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-bold text-white">Pradana Figo Ariansya</h4>
                  <p className="text-sm text-slate-400 mt-1">123140063</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-bold text-white">Awi Septian Prasetyo</h4>
                  <p className="text-sm text-slate-400 mt-1">123140201</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-bold text-white">Muhammad Bimastiar</h4>
                  <p className="text-sm text-slate-400 mt-1">123140211</p>
                </div>
              </div>
              <div className="mt-10 pt-8 border-t border-slate-800 text-slate-400 text-sm font-medium">
                Tugas Besar Sistem Informasi Geografis (T1) <br/> 
                <span className="text-amber-500 block mt-1">Institut Teknologi Sumatera</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 text-center relative overflow-hidden z-20 border-t border-slate-900">
        <p className="text-slate-500 text-sm relative z-10">
          &copy; {new Date().getFullYear()} Tim WebGIS Transportasi Jakarta Timur. Dibuat dengan 💚 di Sumatera.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
