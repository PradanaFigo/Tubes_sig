import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  Circle, 
  useMapEvents, 
  ZoomControl, 
  LayersControl 
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- CUSTOM MARKER ICONS ---
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  className: 'animate-bounce' // Fitur Animasi Membal (Bounce)
});

const API_URL = "http://127.0.0.1:8000/api";

export default function App() {
  // Data States
  const [ruteData, setRuteData] = useState(null);
  const [halteData, setHalteData] = useState(null);
  const [radiusData, setRadiusData] = useState(null);
  
  // Interaction States
  const [searchPoint, setSearchPoint] = useState(null);
  const [radiusMeter, setRadiusMeter] = useState(1000);
  const [activeTab, setActiveTab] = useState('analisis');
  const [isSelectingPoint, setIsSelectingPoint] = useState(false);
  const [formHalte, setFormHalte] = useState({ nama_halte: '', lat: '', lon: '' });

  useEffect(() => {
    fetchRute();
    fetchHalte();
  }, []);

  const fetchRute = async () => { 
    try { const res = await axios.get(`${API_URL}/rute`); setRuteData(res.data); } catch (e) { console.error(e); } 
  };
  const fetchHalte = async () => { 
    try { const res = await axios.get(`${API_URL}/halte`); setHalteData(res.data); } catch (e) { console.error(e); } 
  };

  const handleCariRadius = async () => {
    if (!searchPoint) return alert("Silakan tentukan titik pusat di peta terlebih dahulu!");
    try {
      const res = await axios.get(`${API_URL}/analisis/halte-terdekat`, {
        params: { lat: searchPoint.lat, lon: searchPoint.lng, radius_meter: radiusMeter }
      });
      setRadiusData(res.data);
    } catch (error) { 
      setRadiusData(null); 
      alert("Tidak ditemukan halte dalam radius tersebut."); 
    }
  };

  const handleTambahHalte = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/halte`, formHalte);
      alert("Data berhasil disimpan ke PostGIS!");
      fetchHalte();
      setFormHalte({ nama_halte: '', lat: '', lon: '' });
    } catch (e) { alert("Gagal menyimpan data."); }
  };

  // Event Handler untuk klik peta
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (isSelectingPoint) {
          setSearchPoint(e.latlng);
          setIsSelectingPoint(false);
          setRadiusData(null);
        } else if (activeTab === 'tambah') {
          setFormHalte({ ...formHalte, lat: e.latlng.lat, lon: e.latlng.lng });
        }
      },
    });
    return null;
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden font-sans">
      
      {/* 1. FLOATING DASHBOARD PANEL (KIRI) */}
      <div className="absolute top-5 left-5 z-[1000] w-[390px] bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl border border-white/20 flex flex-col max-h-[92vh] transition-all duration-500">
        
        {/* Header dengan Gradient & Shadow */}
        <div className="bg-gradient-to-br from-[#1a73e8] to-[#0d47a1] p-6 rounded-t-3xl shadow-lg border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md text-3xl shadow-inner border border-white/30">🚌</div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none drop-shadow-md">SmartGIS</h1>
              <p className="text-blue-100 text-[10px] font-bold mt-2 uppercase tracking-[0.2em] opacity-90">Sistem Informasi Transportasi</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-2 bg-gray-100/50 m-4 rounded-2xl gap-1 border border-gray-200/50">
          <button 
            onClick={() => setActiveTab('analisis')} 
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${activeTab === 'analisis' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-gray-500 hover:bg-white/50'}`}>
            ANALISIS SPASIAL
          </button>
          <button 
            onClick={() => setActiveTab('tambah')} 
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${activeTab === 'tambah' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-gray-500 hover:bg-white/50'}`}>
            MANAJEMEN DATA
          </button>
        </div>

        <div className="px-6 pb-6 overflow-y-auto scrollbar-hide flex-grow">
          {activeTab === 'analisis' ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => setIsSelectingPoint(!isSelectingPoint)} 
                className={`w-full py-4 rounded-2xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-3 active:scale-95 ${isSelectingPoint ? 'bg-red-50 border-red-400 text-red-600 animate-pulse' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:shadow-lg'}`}>
                {isSelectingPoint ? '🛑 BATALKAN PILIHAN' : '📍 TENTUKAN TITIK PUSAT'}
              </button>

              <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-1 rounded-2xl">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-[9px] font-black text-gray-400 mb-1 uppercase">Lat</p>
                  <p className="text-xs font-mono font-bold text-gray-700">{searchPoint ? searchPoint.lat.toFixed(5) : '-'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-[9px] font-black text-gray-400 mb-1 uppercase">Lon</p>
                  <p className="text-xs font-mono font-bold text-gray-700">{searchPoint ? searchPoint.lng.toFixed(5) : '-'}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-3 items-end px-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Radius Jangkauan</label>
                  <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{radiusMeter}m</span>
                </div>
                <input 
                  type="range" min="100" max="5000" step="100" 
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                  value={radiusMeter} 
                  onChange={(e) => setRadiusMeter(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleCariRadius} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-1 active:translate-y-0">
                PROSES ANALISIS RADIUS
              </button>

              {radiusData && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl shadow-inner animate-in zoom-in-95 duration-300">
                  <p className="text-xs text-emerald-800 font-bold flex items-center gap-2">✅ Berhasil: {radiusData.features.length} Halte Terdeteksi</p>
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                    {radiusData.features.map((f, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl text-[11px] font-bold text-gray-600 shadow-sm border border-emerald-50 flex items-center gap-3 transition-transform hover:scale-[1.02]">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                        {f.properties.nama_halte}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleTambahHalte} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-2">
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">Klik sembarang tempat pada peta untuk mengambil koordinat secara otomatis.</p>
              </div>
              <input 
                type="text" placeholder="Nama Halte Baru" required 
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-inner" 
                value={formHalte.nama_halte} 
                onChange={e => setFormHalte({...formHalte, nama_halte: e.target.value})} 
              />
              <div className="flex gap-3">
                <input type="text" placeholder="Latitude" readOnly className="w-1/2 bg-gray-100 border-none rounded-2xl p-4 text-xs font-mono font-bold text-gray-500" value={formHalte.lat} />
                <input type="text" placeholder="Longitude" readOnly className="w-1/2 bg-gray-100 border-none rounded-2xl p-4 text-xs font-mono font-bold text-gray-500" value={formHalte.lon} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95">SIMPAN KE DATABASE</button>
            </form>
          )}
        </div>
      </div>

      {/* 2. REAL-TIME STATISTICS DASHBOARD (KANAN ATAS) */}
      <div className="absolute top-5 right-5 z-[1000] flex gap-3 pointer-events-none group">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/20 text-center min-w-[110px] transform transition-all group-hover:scale-105 pointer-events-auto">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Total Halte</p>
          <p className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{halteData?.features.length || 0}</p>
        </div>
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/20 text-center min-w-[110px] transform transition-all group-hover:scale-105 pointer-events-auto">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Total Jalur</p>
          <p className="text-2xl font-black text-blue-600 tracking-tight leading-tight">{ruteData?.features.length || 0}</p>
        </div>
      </div>

      {/* 3. MAP ENGINE WITH LAYER CONTROL */}
      <MapContainer 
        center={[-6.225, 106.90]} 
        zoom={13} 
        zoomControl={false} 
        className="w-full h-full"
      >
        <LayersControl position="bottomleft">
          <LayersControl.BaseLayer checked name="🌐 Modern Canvas">
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
              attribution='&copy; CARTO'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🛰️ Satellite View">
            <TileLayer 
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
              attribution='&copy; Esri'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🗺️ Terrain Map">
            <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <ZoomControl position="bottomright" />
        <MapEvents />

        {/* Layer Rute dengan Hover Effect */}
        {ruteData && <GeoJSON 
          data={ruteData} 
          style={(f) => ({ 
            color: f.properties.warna_jalur || '#3b82f6', 
            weight: 4, 
            opacity: 0.6,
            lineJoin: 'round'
          })} 
          onEachFeature={(f, l) => {
            const p = f.properties;
            l.bindPopup(`
              <div class="p-3 font-sans min-w-[180px]">
                <h4 class="font-black text-blue-600 text-sm uppercase">${p.nama_rute}</h4>
                <div class="h-1 bg-blue-100 my-2 rounded-full overflow-hidden">
                   <div class="h-full bg-blue-600 w-1/3"></div>
                </div>
                <p class="text-[10px] text-gray-500 font-bold uppercase">Kode Jalur: ${p.kode_rute}</p>
              </div>
            `);
            
            // Fitur Hover Effect (Menebal & Glow)
            l.on('mouseover', () => {
              l.setStyle({ weight: 10, opacity: 1 });
            });
            l.on('mouseout', () => {
              l.setStyle({ weight: 4, opacity: 0.6 });
            });
          }} 
        />}

        {/* Layer Halte Utama */}
        {halteData && <GeoJSON 
          data={halteData} 
          pointToLayer={(f, latlng) => L.marker(latlng, { icon: blueIcon })} 
          onEachFeature={(f, l) => {
            l.bindPopup(`<div class="font-black text-slate-800 p-1">${f.properties.nama_halte}</div>`);
          }} 
        />}

        {/* Analisis Buffer Visual */}
        {searchPoint && (
          <Circle 
            center={searchPoint} 
            radius={radiusMeter} 
            pathOptions={{ 
              fillColor: '#3b82f6', 
              color: '#2563eb', 
              weight: 2, 
              fillOpacity: 0.15,
              dashArray: '10, 10' 
            }} 
          />
        )}

        {/* Layer Halte Hasil Analisis (Animasi Bounce) */}
        {radiusData && (
          <GeoJSON 
            key={JSON.stringify(radiusData)} // Force re-render for animation
            data={radiusData} 
            pointToLayer={(f, latlng) => L.marker(latlng, { icon: redIcon })} 
            onEachFeature={(f, l) => {
              l.bindPopup(`<div class="font-black text-red-600 p-1">TARGET: ${f.properties.nama_halte}</div>`);
            }}
          />
        )}
      </MapContainer>

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce {
          animation: bounce 0.8s infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}