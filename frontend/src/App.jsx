import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, GeoJSON, Circle, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- KONFIGURASI MARKER KUSTOM ---
const blueIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const API_URL = "http://127.0.0.1:8000/api";

const MAP_LAYERS = {
  modern: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satelit: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  terrain: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
};

export default function App() {
  // === STATE DATA ===
  const [ruteData, setRuteData] = useState(null);
  const [halteData, setHalteData] = useState(null);
  const [radiusData, setRadiusData] = useState(null);
  const [intersectData, setIntersectData] = useState(null); 
  
  // === STATE INTERAKSI & FORM ===
  const [searchPoint, setSearchPoint] = useState(null);
  const [radiusMeter, setRadiusMeter] = useState(1000);
  const [activeTab, setActiveTab] = useState('analisis');
  const [isSelectingPoint, setIsSelectingPoint] = useState(false);
  
  // State untuk Highlight Hasil Pencarian Rute
  const [selectedRouteCode, setSelectedRouteCode] = useState(null);
  
  // === STATE PENCARIAN (LIVE SEARCH) ===
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [formHalte, setFormHalte] = useState({ 
    nama_halte: '', alamat_jalan: '', tipe_halte: 'platform', rute_terhubung: '', fasilitas_shelter: 'yes', lat: '', lon: '' 
  });
  
  // === STATE AUTENTIKASI ADMIN ===
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // === STATE UI ===
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapType, setMapType] = useState('modern');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  const mapRef = useRef(null);

  // Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data Awal
  useEffect(() => {
    fetchRute();
    fetchHalte();
    window.hapusHalte = async (id) => {
      if (window.confirm("Menghapus halte bersifat permanen. Lanjutkan?")) {
        try { 
          await axios.delete(`${API_URL}/halte/${id}`); 
          fetchHalte(); 
        } catch (error) { 
          alert("Gagal menghapus halte."); 
        }
      }
    };
    return () => { delete window.hapusHalte; };
  }, []);

  const fetchRute = async () => { try { const res = await axios.get(`${API_URL}/rute`); setRuteData(res.data); } catch (e) {} };
  const fetchHalte = async () => { try { const res = await axios.get(`${API_URL}/halte`); setHalteData(res.data); } catch (e) {} };

  // === FUNGSI PENCARIAN & HIGHLIGHT ===
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const q = query.toLowerCase();
    const resHalte = halteData?.features.filter(f => f.properties.nama_halte.toLowerCase().includes(q)).slice(0, 4) || [];
    const resRute = ruteData?.features.filter(f => f.properties.nama_rute.toLowerCase().includes(q) || f.properties.kode_rute.toLowerCase().includes(q)).slice(0, 3) || [];

    setSearchResults([
      ...resHalte.map(h => ({ ...h, resultType: 'halte' })),
      ...resRute.map(r => ({ ...r, resultType: 'rute' }))
    ]);
  };

  const handleSelectSearchResult = (item) => {
    if (item.resultType === 'halte') {
      // 1. Zoom/Terbang ke halte tanpa mengubah warna marker
      const [lon, lat] = item.geometry.coordinates;
      mapRef.current.flyTo([lat, lon], 17, { animate: true, duration: 1.5 });
      
      setSelectedRouteCode(null); // Reset rute highlight jika ada
      setSearchQuery(item.properties.nama_halte);

    } else if (item.resultType === 'rute') {
      // 1. Beri warna kuning emas pada rute
      setSelectedRouteCode(item.properties.kode_rute);
      setSearchQuery(`${item.properties.kode_rute} - ${item.properties.nama_rute}`);
      
      // 2. Kalkulasi bounding box untuk zoom paskan layar ke rute
      const routeLayer = L.geoJSON(item);
      const bounds = routeLayer.getBounds();
      if (bounds.isValid() && mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
      }
    }
    setSearchResults([]); 
  };

  // === FUNGSI AUTENTIKASI ===
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    try {
      const response = await axios.post(`${API_URL}${endpoint}`, { username, password });
      if (isRegisterMode) {
        alert("Pendaftaran berhasil! Silakan login.");
        setIsRegisterMode(false); 
      } else {
        setIsAdmin(true);
        setShowAuthModal(false);
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Autentikasi gagal!");
    }
  };

  const handleLogout = () => { setIsAdmin(false); setActiveTab('analisis'); };

  // === FUNGSI ANALISIS SPASIAL ===
  const handleCariRadius = async () => {
    if (!searchPoint) return alert("Pilih titik pusat di peta terlebih dahulu.");
    
    try {
      const resHalte = await axios.get(`${API_URL}/analisis/halte-terdekat`, { params: { lat: searchPoint.lat, lon: searchPoint.lng, radius_meter: radiusMeter } });
      setRadiusData(resHalte.data);
    } catch (error) { setRadiusData({ features: [] }); }

    try {
      const resRute = await axios.get(`${API_URL}/analisis/rute-intersect`, { params: { lat: searchPoint.lat, lon: searchPoint.lng, radius_meter: radiusMeter } });
      setIntersectData(resRute.data);
    } catch (error) { setIntersectData({ features: [] }); }
  };

  const handleClearRadius = () => {
    setSearchPoint(null); setRadiusData(null); setIntersectData(null);
    setIsSelectingPoint(false); setSelectedRouteCode(null); setSearchQuery('');
  };

  const handleTambahHalte = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/halte`, formHalte);
      alert("Data berhasil ditambahkan ke PostGIS.");
      fetchHalte();
      setFormHalte({ nama_halte: '', alamat_jalan: '', tipe_halte: 'platform', rute_terhubung: '', fasilitas_shelter: 'yes', lat: '', lon: '' });
    } catch (e) { alert("Gagal menyimpan data."); }
  };

  const handleRecenter = () => { if (mapRef.current) mapRef.current.setView([-6.225, 106.90], 13, {animate: true}); };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (isSelectingPoint) {
          setSearchPoint(e.latlng); setIsSelectingPoint(false); setRadiusData(null); setIntersectData(null);
        } else if (activeTab === 'tambah' && isPanelOpen && isAdmin) {
          setFormHalte({ ...formHalte, lat: e.latlng.lat, lon: e.latlng.lng });
        } else {
          setSelectedRouteCode(null);
        }
      },
    });
    return null;
  };

  const highlightedHalteIds = radiusData?.features ? radiusData.features.map(f => f.properties.id_halte) : [];
  const intersectedRuteCodes = intersectData?.features ? intersectData.features.map(f => f.properties.kode_rute) : [];

  return (
    <div className="relative w-full h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      {/* MODAL AUTENTIKASI */}
      {showAuthModal && (
        <div className="absolute inset-0 z-[9999] bg-slate-900/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-[360px] overflow-hidden">
            <div className="flex bg-gray-50 border-b border-gray-100">
              <button onClick={() => setIsRegisterMode(false)} className={`flex-1 py-4 text-sm font-bold transition-colors ${!isRegisterMode ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Masuk (Log In)</button>
              <button onClick={() => setIsRegisterMode(true)} className={`flex-1 py-4 text-sm font-bold transition-colors ${isRegisterMode ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Daftar Akun</button>
            </div>
            <form onSubmit={handleAuth} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">ID Pengguna</label>
                  <input type="text" placeholder="Ketik username..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Kata Sandi</label>
                  <input type="password" placeholder="Ketik kata sandi..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm transition-colors">Tutup</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/30">{isRegisterMode ? 'Daftar Sekarang' : 'Masuk Sistem'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEARCH BAR (Tampil Saat Panel Utama Ditutup) */}
      {!isPanelOpen && (
        <div className="absolute top-5 left-5 z-[1001] transition-all duration-300">
          <button onClick={() => setIsPanelOpen(true)} className="bg-white px-5 py-4 rounded-2xl shadow-lg flex items-center gap-4 hover:bg-gray-50 transition-all border border-gray-100 w-[380px]">
            <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span className="font-medium text-sm text-gray-500 tracking-wide truncate">
               {isAdmin ? 'Cari & Kelola Data Spasial...' : 'Jelajahi Peta Transportasi...'}
            </span>
          </button>
        </div>
      )}

      {/* MAIN DASHBOARD PANEL */}
      <div className={`absolute top-5 left-5 z-[1002] w-[400px] bg-white shadow-2xl rounded-3xl border border-gray-100 flex flex-col max-h-[92vh] transition-all duration-400 ease-in-out ${isPanelOpen ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0'}`}>
        
        {/* HEADER PANEL DINAMIS (Admin vs Publik) */}
        <div className={`px-6 py-5 border-b border-gray-50 flex justify-between items-center rounded-t-3xl ${isAdmin ? 'bg-slate-900 text-white' : 'bg-white'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-xl ${isAdmin ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            </div>
            <div>
              <h1 className={`text-[17px] font-extrabold leading-tight ${isAdmin ? 'text-white' : 'text-gray-800'}`}>Sistem Informasi Geografis</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isAdmin ? 'text-slate-400' : 'text-gray-400'}`}>
                {isAdmin ? 'Administrator Panel' : 'Public Explorer'}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => isAdmin ? handleLogout() : setShowAuthModal(true)} className={`transition-colors rounded-xl p-2 ${isAdmin ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50'}`} title={isAdmin ? "Keluar Sistem" : "Login Pengelola"}>
              {isAdmin ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
            </button>
            <button onClick={() => setIsPanelOpen(false)} className={`transition-colors rounded-xl p-2 ${isAdmin ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-gray-400 hover:text-gray-800 bg-gray-50 hover:bg-gray-100'}`}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        {/* TAB MENU */}
        <div className="flex border-b border-gray-50 px-2 pt-2 bg-white">
          <button onClick={() => setActiveTab('analisis')} className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-widest transition-all rounded-t-xl ${activeTab === 'analisis' ? 'text-blue-600 bg-blue-50/50 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}>Eksplorasi</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('tambah')} className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-widest transition-all rounded-t-xl ${activeTab === 'tambah' ? 'text-blue-600 bg-blue-50/50 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}>Manajemen Basis Data</button>
          )}
        </div>

        {/* CONTENT PANEL */}
        <div className="p-6 overflow-y-auto flex-grow bg-white rounded-b-3xl custom-scrollbar relative">
          {activeTab === 'analisis' ? (
            <div className="space-y-6 animate-in fade-in">
              
              {/* SEARCH BAR DINAMIS */}
              <div className="relative z-50">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all">
                  <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <input type="text" placeholder={isAdmin ? "Cari Rute & Halte..." : "Jelajahi Peta Transportasi..."} className="w-full bg-transparent text-sm outline-none font-medium text-gray-700" value={searchQuery} onChange={handleSearchInput} />
                  {searchQuery && (
                    <button onClick={() => {setSearchQuery(''); setSearchResults([]); setSelectedRouteCode(null);}} className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                  )}
                </div>
                
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                    {searchResults.map((item, idx) => (
                      <button key={idx} onClick={() => handleSelectSearchResult(item)} className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 transition-colors flex items-center gap-3">
                        {item.resultType === 'halte' ? (
                           <div className="bg-green-100 text-green-600 p-1.5 rounded-lg shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg></div>
                        ) : (
                           <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
                        )}
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{item.resultType === 'halte' ? item.properties.nama_halte : item.properties.nama_rute}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.resultType === 'halte' ? 'Titik Lokasi' : `Kode Jalur: ${item.properties.kode_rute}`}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PEMBATAS */}
              <div className="flex items-center gap-3 opacity-50">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alat Analisis Spasial</span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              <button onClick={() => setIsSelectingPoint(!isSelectingPoint)} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${isSelectingPoint ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 shadow-sm'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {isSelectingPoint ? 'Batalkan Pemilihan Titik' : 'Tentukan Pusat Area di Peta'}
              </button>
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Titik Koordinat Fokus</p>
                <p className="text-sm font-mono font-bold text-gray-700">{searchPoint ? `${searchPoint.lat.toFixed(5)}, ${searchPoint.lng.toFixed(5)}` : 'Menunggu pilihan di peta...'}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rentang Radius</label>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{radiusMeter} m</span>
                </div>
                <input type="range" min="100" max="5000" step="100" className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" value={radiusMeter} onChange={(e) => setRadiusMeter(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button onClick={handleCariRadius} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-600/30">Mulai Analisis</button>
                <button onClick={handleClearRadius} className="bg-white hover:bg-gray-50 text-gray-600 font-bold py-3 px-5 rounded-xl transition-colors text-sm border border-gray-200 shadow-sm">Reset</button>
              </div>

              {intersectData?.features && intersectData.features.length > 0 && (
                 <div className="mt-2 border border-blue-100 rounded-xl overflow-hidden bg-blue-50 px-5 py-4">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">Hasil ST_Intersects</p>
                    <p className="text-sm font-medium text-blue-900 leading-snug">Ditemukan <span className="font-extrabold">{intersectData.features.length} Jalur</span> yang melintasi area target.</p>
                 </div>
              )}

              {radiusData?.features && radiusData.features.length >= 0 && (
                 <div className="mt-2 border border-green-100 rounded-xl overflow-hidden">
                   <div className="bg-green-50 px-5 py-3.5 border-b border-green-100 flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                     <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Hasil ST_DWithin</p>
                   </div>
                   <div className="max-h-48 overflow-y-auto bg-white">
                     {radiusData.features.length === 0 ? (
                       <div className="px-5 py-4 text-xs font-bold text-gray-400 text-center">Tidak ada lokasi dalam jangkauan</div>
                     ) : (
                       radiusData.features.map((f, i) => (
                         <div key={i} className="px-5 py-3.5 text-[13px] font-medium text-gray-700 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                           <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                           <span className="truncate">{f.properties.nama_halte}</span>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
              )}
            </div>
          ) : isAdmin ? (
            <form onSubmit={handleTambahHalte} className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-2.5 mb-2">
                <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-[11px] text-gray-600 font-medium leading-relaxed">Ketuk peta untuk menentukan koordinat otomatis secara akurat.</p>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nama Titik Lokasi</label><input type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all focus:bg-white" value={formHalte.nama_halte} onChange={e => setFormHalte({...formHalte, nama_halte: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Detail Alamat</label><input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all focus:bg-white" value={formHalte.alamat_jalan} onChange={e => setFormHalte({...formHalte, alamat_jalan: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Jenis Infrastruktur</label><select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white" value={formHalte.tipe_halte} onChange={e => setFormHalte({...formHalte, tipe_halte: e.target.value})}><option value="platform">Platform Shelter</option><option value="bus_stop">Titik Pemberhentian</option></select></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Status Fasilitas</label><select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white" value={formHalte.fasilitas_shelter} onChange={e => setFormHalte({...formHalte, fasilitas_shelter: e.target.value})}><option value="yes">Memadai</option><option value="no">Tidak Memadai</option></select></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Koneksi Jalur Angkutan</label><input type="text" placeholder="Gunakan koma, misal: 1A, 2, 6B" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all focus:bg-white" value={formHalte.rute_terhubung} onChange={e => setFormHalte({...formHalte, rute_terhubung: e.target.value})} /></div>
              <div className="flex gap-4">
                <div className="w-1/2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Garis Lintang (Lat)</label><input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[12px] font-mono text-gray-500 cursor-not-allowed" value={formHalte.lat} /></div>
                <div className="w-1/2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Garis Bujur (Lon)</label><input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[12px] font-mono text-gray-500 cursor-not-allowed" value={formHalte.lon} /></div>
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-sm mt-4 shadow-lg shadow-slate-900/20 transition-all">Upload ke Database PostGIS</button>
            </form>
          ) : null}
        </div>
      </div>

      {/* STATISTIK MENYATU KANAN ATAS */}
      <div className="absolute top-5 right-5 z-[1000] flex bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden pointer-events-auto">
        <div className="px-6 py-3.5 border-r border-gray-50 flex flex-col justify-center bg-gray-50/50">
           <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sistem Jam</span>
           <span className="text-sm font-mono font-bold text-gray-700">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="px-6 py-3.5 border-r border-gray-50 flex flex-col justify-center items-center">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Data Halte</span>
          <span className="text-lg font-black text-gray-800 leading-none">{halteData?.features.length || 0}</span>
        </div>
        <div className="px-6 py-3.5 flex flex-col justify-center items-center">
           <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Data Jalur</span>
           <span className="text-lg font-black text-blue-600 leading-none">{ruteData?.features.length || 0}</span>
        </div>
      </div>

      {/* TOMBOL RECENTER */}
      <div className="absolute bottom-28 right-5 z-[1000] flex flex-col gap-3 items-end pointer-events-none">
        <button onClick={handleRecenter} className="bg-white p-3.5 rounded-2xl shadow-lg border border-gray-100 text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors pointer-events-auto" title="Pusatkan Layar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      {/* LAYER CONTROL KIRI BAWAH */}
      <div className="absolute bottom-6 left-5 z-[1000] flex flex-col justify-end items-start" onMouseEnter={() => setIsLayerMenuOpen(true)} onMouseLeave={() => setIsLayerMenuOpen(false)}>
        <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col font-medium text-xs text-gray-600 transition-all duration-300 transform origin-bottom-left mb-3 ${isLayerMenuOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
          <button onClick={() => setMapType('modern')} className={`px-5 py-3.5 text-left transition-colors border-b border-gray-50 flex items-center gap-3 ${mapType === 'modern' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>Peta Kanvas Modern</button>
          <button onClick={() => setMapType('satelit')} className={`px-5 py-3.5 text-left transition-colors border-b border-gray-50 flex items-center gap-3 ${mapType === 'satelit' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Citra Satelit Bumi</button>
          <button onClick={() => setMapType('terrain')} className={`px-5 py-3.5 text-left transition-colors flex items-center gap-3 ${mapType === 'terrain' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>Peta Topografi Fisik</button>
        </div>
        <button className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors pointer-events-auto w-14 h-14 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
        </button>
      </div>

      {/* MAP ENGINE PUSAT */}
      <MapContainer center={[-6.225, 106.90]} zoom={13} zoomControl={false} className="w-full h-full z-0" ref={mapRef}>
        <TileLayer url={MAP_LAYERS[mapType]} />
        <ZoomControl position="bottomright" />
        <MapEvents />

        {/* LAYER RUTE */}
        {ruteData && <GeoJSON 
          key={`rute-${selectedRouteCode}-${intersectData ? '1' : '0'}`} 
          data={ruteData} 
          style={(f) => {
            const isSelected = f.properties.kode_rute === selectedRouteCode;
            const isIntersected = intersectedRuteCodes.includes(f.properties.kode_rute);
            return {
              color: isSelected ? '#f59e0b' : (isIntersected ? '#ef4444' : (f.properties.warna_jalur || '#1a73e8')), 
              weight: isSelected || isIntersected ? 8 : 4,
              opacity: isSelected || isIntersected ? 1 : 0.75,
              lineJoin: 'round'
            };
          }} 
          onEachFeature={(f, l) => {
            const p = f.properties;
            l.bindPopup(`
              <div class="font-sans w-[240px] p-1.5">
                <div class="mb-4">
                  <h4 class="font-extrabold text-gray-800 text-[15px] leading-tight mb-1.5">${p.nama_rute}</h4>
                  <span class="inline-block bg-blue-50 text-blue-600 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest border border-blue-100">${p.kode_rute}</span>
                </div>
                <div id="loading-panjang-${p.kode_rute}" class="text-[11px] text-gray-500 mt-2 mb-3 italic flex items-center gap-1.5"><svg class="animate-spin w-3 h-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Menghitung panjang rute spasial...</div>
                <div id="hasil-panjang-${p.kode_rute}" class="hidden bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-[11px] font-bold border border-emerald-100 mb-3"></div>
                <div class="space-y-2.5 text-[12px] text-gray-600 border-t border-gray-100 pt-3.5">
                  <div class="flex justify-between"><span class="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Metode Angkut</span><span class="font-bold text-gray-800">${p.jenis_angkutan || '-'}</span></div>
                  <div class="flex justify-between"><span class="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Jam Operasi</span><span class="font-bold text-gray-800">${p.jam_operasional || '-'}</span></div>
                </div>
              </div>
            `);
            l.on('mouseover', function() { 
              const isIntersected = intersectedRuteCodes.includes(this.feature.properties.kode_rute);
              if (this.feature.properties.kode_rute !== selectedRouteCode) this.setStyle({ weight: isIntersected ? 9 : 7, opacity: 1 }); 
            });
            l.on('mouseout', function() { 
              const isIntersected = intersectedRuteCodes.includes(this.feature.properties.kode_rute);
              if (this.feature.properties.kode_rute !== selectedRouteCode) this.setStyle({ weight: isIntersected ? 8 : 4, opacity: isIntersected ? 1 : 0.75 }); 
            });
            l.on('click', async function() {
              setSelectedRouteCode(this.feature.properties.kode_rute);
              this.bringToFront(); 
              try {
                const res = await axios.get(`${API_URL}/analisis/panjang-rute/${p.kode_rute}`);
                document.getElementById(`loading-panjang-${p.kode_rute}`).style.display = 'none';
                const divHasil = document.getElementById(`hasil-panjang-${p.kode_rute}`);
                divHasil.style.display = 'block';
                divHasil.innerHTML = `Estimasi Panjang Rute (ST_Length): <br/><span class="text-sm text-emerald-900">${res.data.panjang_km} Kilometer</span>`;
              } catch(e) { document.getElementById(`loading-panjang-${p.kode_rute}`).innerHTML = 'Gagal memuat perhitungan'; }
            });
          }} 
        />}

        {/* LAYER HALTE STANDAR (Menggunakan ikon default biru murni) */}
        {halteData && <GeoJSON 
          key={`halte-${isAdmin ? 'admin' : 'public'}-${radiusData ? 'radius' : 'noradius'}`}
          data={halteData} 
          filter={(f) => !highlightedHalteIds.includes(f.properties.id_halte)}
          pointToLayer={(f, latlng) => L.marker(latlng, { icon: blueIcon })} 
          onEachFeature={(f, l) => {
            const p = f.properties;
            const btnHapus = isAdmin ? `<button onclick="window.hapusHalte(${p.id_halte})" class="w-full mt-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold py-2.5 rounded-lg transition-colors text-xs flex justify-center items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Hapus Data </button>` : '';
            l.bindPopup(`
              <div class="font-sans min-w-[210px] p-1.5">
                <div class="mb-3">
                  <h4 class="font-extrabold text-gray-800 text-[15px] leading-tight mb-1">${p.nama_halte}</h4>
                  <span class="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">ID: ${p.id_halte}</span>
                </div>
                <p class="text-[11px] text-gray-500 leading-snug mb-3.5 pb-3 border-b border-gray-100 flex items-start gap-1.5">
                  <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  ${p.alamat_jalan || 'Data lokasi fisik tidak tersimpan'}
                </p>
                <div class="space-y-2.5 text-[12px] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div class="flex justify-between items-center"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Infrastruktur</span><span class="font-bold text-gray-700 capitalize">${p.tipe_halte?.replace('_', ' ') || '-'}</span></div>
                  <div class="flex justify-between items-center"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Fasilitas</span><span class="font-bold text-gray-700">${p.fasilitas_shelter === 'yes' ? '✅ Memadai' : '❌ Tidak Ada'}</span></div>
                  <div class="flex justify-between items-center pt-1.5 border-t border-gray-200/60"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Transit</span><span class="font-bold text-blue-600">${p.rute_terhubung || '-'}</span></div>
                </div>
                ${btnHapus}
              </div>
            `);
          }} 
        />}

        {searchPoint && <Circle center={searchPoint} radius={radiusMeter} pathOptions={{ fillColor: '#1a73e8', color: '#1a73e8', weight: 2, fillOpacity: 0.1, dashArray: '6, 6' }} />}
        
        {radiusData && <GeoJSON 
          key={`radius-${Date.now()}`} 
          data={radiusData} 
          pointToLayer={(feature, latlng) => L.marker(latlng, { icon: redIcon })} 
          onEachFeature={(f, l) => {
            const p = f.properties;
            const btnHapus = isAdmin ? `<button onclick="window.hapusHalte(${p.id_halte})" class="w-full mt-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold py-2.5 rounded-lg transition-colors text-xs flex justify-center items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eksekusi Hapus Data (Khusus Admin)</button>` : '';
            l.bindPopup(`
              <div class="font-sans min-w-[240px] p-1.5">
                <div class="text-red-500 font-extrabold text-[10px] mb-2.5 uppercase tracking-widest flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Radius Evaluasi ST_DWithin</div>
                <div class="mb-3">
                  <h4 class="font-extrabold text-gray-800 text-[15px] leading-tight mb-1">${p.nama_halte}</h4>
                  <span class="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">ID: ${p.id_halte}</span>
                </div>
                <p class="text-[11px] text-gray-500 leading-snug mb-3 pb-3 border-b border-gray-100 flex items-start gap-1.5">
                  <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  ${p.alamat_jalan || 'Data lokasi fisik tidak tersimpan'}
                </p>
                <div class="space-y-2.5 text-[12px] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div class="flex justify-between items-center"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Infrastruktur</span><span class="font-bold text-gray-700 capitalize">${p.tipe_halte?.replace('_', ' ') || '-'}</span></div>
                  <div class="flex justify-between items-center"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Fasilitas</span><span class="font-bold text-gray-700">${p.fasilitas_shelter === 'yes' ? '✅ Memadai' : '❌ Tidak Ada'}</span></div>
                  <div class="flex justify-between items-center pt-1.5 border-t border-gray-200/60"><span class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Transit</span><span class="font-bold text-blue-600">${p.rute_terhubung || '-'}</span></div>
                </div>
                ${btnHapus}
              </div>
            `);
          }}
        />}
      </MapContainer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
        .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1px solid #f3f4f6; padding: 4px;}
        .leaflet-popup-content { margin: 16px; }
        .leaflet-container a.leaflet-popup-close-button { top: 16px; right: 16px; color: #9ca3af; font-weight: bold; }
        .leaflet-container a.leaflet-popup-close-button:hover { color: #1f2937; }
      `}</style>
    </div>
  );
}