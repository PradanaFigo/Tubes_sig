import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, GeoJSON, Circle, useMapEvents, ZoomControl, Polyline, Marker, Popup, Rectangle, useMap, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- KONFIGURASI MARKER "TEARDROP PIN" ALA GOOGLE MAPS ---
const createGoogleStyleIcon = (bgColorClass, extraClass = '') => {
  return new L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center ${extraClass} drop-shadow-md transition-transform hover:z-50">
        <div class="w-8 h-8 ${bgColorClass} border-[2px] border-white flex items-center justify-center text-white shadow-sm" style="border-radius: 50% 50% 50% 0; transform: rotate(-45deg);">
          <div style="transform: rotate(45deg);" class="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[15px] h-[15px]">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-10-8V6h11v4H6.5z"/>
            </svg>
          </div>
        </div>
        <div class="w-3 h-1 bg-black/30 rounded-[50%] blur-[1px] mt-0.5"></div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38]
  });
};

const iconDefault = createGoogleStyleIcon('bg-[#1a73e8]', 'hover:scale-110'); 
const iconRadius = createGoogleStyleIcon('bg-[#ea4335]', 'hover:scale-110 z-40'); 
const iconSelected = createGoogleStyleIcon('bg-[#34a853]', 'animate-bounce scale-110 z-50 shadow-lg'); 

const API_URL = "http://127.0.0.1:8000/api";

const MAP_LAYERS = {
  modern: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satelit: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  terrain: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
};

// --- KOMPONEN MINIMAP (RADAR DINAMIS) ---
function MinimapInner({ mainMap }) {
  const minimap = useMap();
  const [bounds, setBounds] = useState(mainMap.getBounds());

  useEffect(() => {
    if (!mainMap) return;
    const updateMinimap = () => {
      setBounds(mainMap.getBounds());
      minimap.setView(mainMap.getCenter(), Math.max(1, mainMap.getZoom() - 1));
    };
    mainMap.on('move', updateMinimap);
    mainMap.on('zoom', updateMinimap);
    updateMinimap();
    return () => { mainMap.off('move', updateMinimap); mainMap.off('zoom', updateMinimap); }
  }, [mainMap, minimap]);

  useMapEvent('click', (e) => {
    mainMap.flyTo(e.latlng, 16, { animate: true, duration: 0.8 });
  });

  return <Rectangle bounds={bounds} weight={1.5} color="#1a73e8" fillOpacity={0} dashArray="4, 4" />;
}

function Minimap({ mainMap, mapUrl }) {
  if (!mainMap) return null;
  return (
    <div style={{ position: 'absolute', bottom: '10px', right: '55px', width: '150px', height: '150px', zIndex: 1000 }} className="bg-white border-2 border-white rounded-[8px] shadow-[0_1px_5px_rgba(0,0,0,0.65)] overflow-hidden pointer-events-auto transition-transform hover:scale-105 group">
      <MapContainer center={mainMap.getCenter()} zoom={10} zoomControl={false} attributionControl={false} dragging={false} doubleClickZoom={false} scrollWheelZoom={false} touchZoom={false} className="w-full h-full cursor-crosshair">
        <TileLayer url={mapUrl} />
        <MinimapInner mainMap={mainMap} />
      </MapContainer>
      <div className="absolute bottom-0 left-0 w-full bg-white/80 text-center py-1 text-[10px] font-extrabold text-slate-700 tracking-widest z-[1001] pointer-events-none group-hover:bg-[#1a73e8] group-hover:text-white transition-colors uppercase">MINIMAP</div>
    </div>
  );
}

// --- KOMPONEN UTAMA ---
export default function App() {
  const [mapInstance, setMapInstance] = useState(null);

  const [ruteData, setRuteData] = useState(null);
  const [halteData, setHalteData] = useState(null);
  const [kecamatanData, setKecamatanData] = useState(null);
  const [radiusData, setRadiusData] = useState(null);
  const [intersectData, setIntersectData] = useState(null); 
  
  const [searchPoint, setSearchPoint] = useState(null);
  const [radiusMeter, setRadiusMeter] = useState(1000);
  const [activeTab, setActiveTab] = useState('analisis');
  const [adminTab, setAdminTab] = useState('halte'); 
  const [isSelectingPoint, setIsSelectingPoint] = useState(false);
  
  const [selectedRouteCode, setSelectedRouteCode] = useState(null);
  const [selectedHalteId, setSelectedHalteId] = useState(null);
  
  // STATE BARU: Untuk menyimpan ID kecamatan yang sedang aktif/menyala biru
  const [activeKecamatanId, setActiveKecamatanId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [measureMode, setMeasureMode] = useState(null);
  const measureModeRef = useRef(measureMode);
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);
  const [measureResult, setMeasureResult] = useState(null);

  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

  const [editHalteId, setEditHalteId] = useState(null);
  const [formHalte, setFormHalte] = useState({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter', fasilitas: '', rute_terhubung: '', lat: '', lon: '' });

  const [editRuteId, setEditRuteId] = useState(null);
  const [formRute, setFormRute] = useState({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' });
  const [newRoutePoints, setNewRoutePoints] = useState([]); 
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // DIUBAH KE FALSE AGAR PANEL TERTUTUP SAAT REFRESH
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapType, setMapType] = useState('modern');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchRute();
    fetchHalte();
    fetchKecamatan();
    
    window.hapusHalte = async (id) => {
      if (window.confirm("Menghapus halte bersifat permanen. Lanjutkan?")) {
        try { await axios.delete(`${API_URL}/halte/${id}`); fetchHalte(); } catch (error) { alert("Gagal menghapus halte."); }
      }
    };
    window.editHalte = (id, nama, alamat, tipe, fas, rute_hub, lat, lon) => {
      setEditHalteId(id);
      setFormHalte({ nama_halte: nama, alamat: alamat, tipe_halte: tipe, fasilitas: fas, rute_terhubung: rute_hub, lat: lat, lon: lon });
      setActiveTab('tambah'); setAdminTab('halte'); setIsPanelOpen(true);
    };

    window.hapusRute = async (id) => {
      if (window.confirm("Menghapus rute bersifat permanen. Lanjutkan?")) {
        try { await axios.delete(`${API_URL}/rute/${id}`); fetchRute(); setSelectedRouteCode(null); } catch (error) { alert("Gagal menghapus rute."); }
      }
    };
    window.editRute = (id, kode, jenis, nama, awal, akhir, jam, warna, coords) => {
      setEditRuteId(id);
      setFormRute({ kode_rute: kode, jenis_angkutan: jenis, nama_rute: nama, rute_awal: awal || '', rute_akhir: akhir || '', jam_operasional: jam, warna_jalur: warna });
      setNewRoutePoints(coords); setActiveTab('tambah'); setAdminTab('rute'); setIsPanelOpen(true);
    };

    window.setTitikA = (id, nama, lat, lon) => { setMeasureStart({ id, nama, lat, lon }); setMeasureMode(null); };
    window.setTitikB = (id, nama, lat, lon) => { setMeasureEnd({ id, nama, lat, lon }); setMeasureMode(null); };

    return () => { 
      delete window.hapusHalte; delete window.editHalte; 
      delete window.hapusRute; delete window.editRute;
      delete window.setTitikA; delete window.setTitikB;
    };
  }, []);

  useEffect(() => {
    if (measureStart && measureEnd) {
      axios.get(`${API_URL}/analisis/jarak-halte/${measureStart.id}/${measureEnd.id}`)
        .then(res => setMeasureResult(res.data)).catch(err => alert("Gagal mengukur jarak antar halte."));
    }
  }, [measureStart, measureEnd]);

  const fetchRute = async () => { try { const res = await axios.get(`${API_URL}/rute`); setRuteData(res.data); } catch (e) {} };
  const fetchHalte = async () => { try { const res = await axios.get(`${API_URL}/halte`); setHalteData(res.data); } catch (e) {} };
  const fetchKecamatan = async () => { try { const res = await axios.get(`${API_URL}/kecamatan`); setKecamatanData(res.data); } catch (e) {} };

  const handleKlikKecamatan = async (id, nama, latlng) => {
    const popup = L.popup({ className: 'custom-popup' })
      .setLatLng(latlng)
      .setContent(`<div class="p-2 text-center text-[11px] font-bold text-gray-500 italic">Menganalisis area Kec. ${nama}...</div>`)
      .openOn(mapInstance);

    try {
      const res = await axios.get(`${API_URL}/analisis/statistik-kecamatan/${id}`);
      const d = res.data;
      
      popup.setContent(`
        <div class="font-sans min-w-[200px] p-1.5 text-center">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Statistik Spasial Wilayah</span>
          <h4 class="font-extrabold text-gray-800 text-[16px] leading-tight mb-3">Kec. ${d.nama_kecamatan}</h4>
          <div class="grid grid-cols-2 gap-2 mb-1">
            <div class="bg-blue-50 border border-blue-100 py-2.5 px-2 rounded-xl shadow-sm">
              <span class="block text-2xl font-black text-blue-600 leading-none mb-1">${d.jumlah_halte}</span>
              <span class="text-[9px] font-extrabold text-blue-500 uppercase tracking-widest">Titik Halte</span>
            </div>
            <div class="bg-amber-50 border border-amber-100 py-2.5 px-2 rounded-xl shadow-sm">
              <span class="block text-2xl font-black text-amber-500 leading-none mb-1">${d.jumlah_rute}</span>
              <span class="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest">Jalur Rute</span>
            </div>
          </div>
        </div>
      `);
    } catch (err) {
      popup.setContent(`<div class="text-[11px] text-red-500 font-bold p-2 text-center">Gagal menghitung data spasial.</div>`);
    }
  };

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) return setSearchResults([]);

    const q = query.toLowerCase();
    const resHalte = halteData?.features.filter(f => f.properties.nama_halte.toLowerCase().includes(q)).slice(0, 4) || [];
    const resRute = ruteData?.features.filter(f => f.properties.nama_rute.toLowerCase().includes(q) || f.properties.kode_rute.toLowerCase().includes(q)).slice(0, 3) || [];

    setSearchResults([...resHalte.map(h => ({ ...h, resultType: 'halte' })), ...resRute.map(r => ({ ...r, resultType: 'rute' }))]);
  };

  const handleSelectSearchResult = (item) => {
    if (item.resultType === 'halte') {
      const [lon, lat] = item.geometry.coordinates;
      mapInstance.flyTo([lat, lon], 17, { animate: true, duration: 1.5 });
      setSelectedHalteId(item.properties.id_halte); setSelectedRouteCode(null); setSearchQuery(item.properties.nama_halte);
    } else if (item.resultType === 'rute') {
      setSelectedRouteCode(item.properties.kode_rute); setSelectedHalteId(null); setSearchQuery(`${item.properties.kode_rute} - ${item.properties.nama_rute}`);
      const bounds = L.geoJSON(item).getBounds();
      if (bounds.isValid() && mapInstance) mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }
    setSearchResults([]); 
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    try {
      await axios.post(`${API_URL}${endpoint}`, { username, password });
      if (isRegisterMode) { alert("Daftar berhasil! Silakan login."); setIsRegisterMode(false); } 
      else { setIsAdmin(true); setShowAuthModal(false); setUsername(''); setPassword(''); }
    } catch (error) { alert("Autentikasi gagal!"); }
  };

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
    setIsSelectingPoint(false); setSelectedRouteCode(null); setSelectedHalteId(null); setSearchQuery('');
  };

  const handleSimpanHalte = async (e) => {
    e.preventDefault();
    try {
      if (editHalteId) { await axios.put(`${API_URL}/halte/${editHalteId}`, formHalte); alert("Data Halte berhasil diperbarui!"); } 
      else { await axios.post(`${API_URL}/halte`, formHalte); alert("Data Halte berhasil ditambahkan!"); }
      fetchHalte(); setEditHalteId(null);
      setFormHalte({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter', fasilitas: '', rute_terhubung: '', lat: '', lon: '' });
    } catch (e) { alert("Gagal menyimpan data halte."); }
  };

  const handleSimpanRute = async (e) => {
    e.preventDefault();
    if (newRoutePoints.length < 2) return alert("Gambarkan rute di peta minimal 2 titik koordinat!");
    const payload = { ...formRute, geojson_geom: JSON.stringify({ type: "LineString", coordinates: newRoutePoints }) };
    try {
      if (editRuteId) { await axios.put(`${API_URL}/rute/${editRuteId}`, payload); alert("Data Rute berhasil diperbarui!"); } 
      else { await axios.post(`${API_URL}/rute`, payload); alert("Data Rute berhasil ditambahkan!"); }
      fetchRute(); setEditRuteId(null); setNewRoutePoints([]);
      setFormRute({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' });
    } catch (e) { alert("Gagal menyimpan data rute."); }
  };

  const handleRecenter = () => { if (mapInstance) mapInstance.setView([-6.225, 106.90], 13, {animate: true}); };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        // RESET HIGHLIGHT KECAMATAN JIKA PETA DIKLIK
        setActiveKecamatanId(null);
        
        if (isSelectingPoint) { setSearchPoint(e.latlng); setIsSelectingPoint(false); setRadiusData(null); setIntersectData(null); } 
        else if (activeTab === 'tambah' && isPanelOpen && isAdmin) {
          if (adminTab === 'halte') setFormHalte({ ...formHalte, lat: e.latlng.lat, lon: e.latlng.lng });
          else if (adminTab === 'rute') setNewRoutePoints([...newRoutePoints, [e.latlng.lng, e.latlng.lat]]);
        } else { setSelectedRouteCode(null); setSelectedHalteId(null); }
      },
    });
    return null;
  };

  const highlightedHalteIds = radiusData?.features ? radiusData.features.map(f => f.properties.id_halte) : [];
  const intersectedRuteCodes = intersectData?.features ? intersectData.features.map(f => f.properties.kode_rute) : [];

  return (
    <div className="relative w-full h-screen bg-[#f8fafc] font-sans text-gray-800 overflow-hidden">
      
      {/* MODAL AUTENTIKASI */}
      {showAuthModal && (
        <div className="absolute inset-0 z-[9999] bg-slate-900/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-[360px] overflow-hidden">
            <div className="flex bg-gray-50 border-b border-gray-100">
              <button onClick={() => setIsRegisterMode(false)} className={`flex-1 py-4 text-sm font-bold transition-colors ${!isRegisterMode ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Masuk</button>
              <button onClick={() => setIsRegisterMode(true)} className={`flex-1 py-4 text-sm font-bold transition-colors ${isRegisterMode ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Daftar Admin</button>
            </div>
            <form onSubmit={handleAuth} className="p-6">
              <div className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">ID Pengguna</label><input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Kata Sandi</label><input type="password" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">Tutup</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-blue-600/30">{isRegisterMode ? 'Daftar' : 'Masuk'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEARCH BAR WIDGET KIRI ATAS (Saat Panel Tertutup) */}
      {!isPanelOpen && (
        <div className="absolute top-5 left-5 z-[1001] transition-all duration-300">
          <button onClick={() => setIsPanelOpen(true)} className="bg-white px-5 py-4 rounded-full shadow-lg flex items-center gap-4 hover:bg-gray-50 transition-all border border-gray-100 w-[380px]">
            <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span className="font-medium text-sm text-gray-500 tracking-wide truncate">{isAdmin ? 'Kelola Data Transportasi...' : 'Jelajahi Peta Transportasi...'}</span>
          </button>
        </div>
      )}

      {/* MAIN DASHBOARD PANEL */}
      <div className={`absolute top-5 left-5 z-[1002] w-[420px] bg-white shadow-2xl rounded-3xl border border-gray-100 flex flex-col max-h-[92vh] transition-all duration-400 ease-in-out ${isPanelOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
        
        <div className={`px-6 py-5 border-b border-gray-50 flex justify-between items-center rounded-t-3xl ${isAdmin ? 'bg-slate-900 text-white' : 'bg-white'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-2xl ${isAdmin ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            </div>
            <div>
              <h1 className={`text-[17px] font-extrabold leading-tight ${isAdmin ? 'text-white' : 'text-gray-800'}`}>Sistem Informasi Geografis</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isAdmin ? 'text-slate-400' : 'text-gray-400'}`}>{isAdmin ? 'Administrator Panel' : 'Public Explorer'}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAuthModal(true)} className={`rounded-xl p-2.5 transition-colors ${isAdmin ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50'}`}>
              {isAdmin ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
            </button>
            <button onClick={() => setIsPanelOpen(false)} className={`rounded-xl p-2.5 transition-colors ${isAdmin ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-gray-400 hover:text-gray-800 bg-gray-50 hover:bg-gray-200'}`}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-100 bg-white/50 backdrop-blur-md">
          <button onClick={() => setActiveTab('analisis')} className={`flex-1 py-3.5 text-xs font-extrabold uppercase tracking-widest transition-all ${activeTab === 'analisis' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:bg-gray-50'}`}>Eksplorasi</button>
          {isAdmin && <button onClick={() => setActiveTab('tambah')} className={`flex-1 py-3.5 text-xs font-extrabold uppercase tracking-widest transition-all ${activeTab === 'tambah' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:bg-gray-50'}`}>Manajemen Data</button>}
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-white rounded-b-3xl custom-scrollbar relative">
          {activeTab === 'analisis' ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="relative z-50">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:border-blue-500 transition-all">
                  <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <input type="text" placeholder="Telusuri Halte & Rute..." className="w-full bg-transparent text-sm outline-none font-medium text-gray-700" value={searchQuery} onChange={handleSearchInput} />
                  {searchQuery && <button onClick={() => {setSearchQuery(''); setSearchResults([]); setSelectedRouteCode(null); setSelectedHalteId(null);}} className="text-gray-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                    {searchResults.map((item, idx) => (
                      <button key={idx} onClick={() => handleSelectSearchResult(item)} className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg shrink-0 ${item.resultType === 'halte' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{item.resultType === 'halte' ? item.properties.nama_halte : item.properties.nama_rute}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.resultType === 'halte' ? 'Titik Lokasi' : `Kode: ${item.properties.kode_rute}`}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* MENU DAFTAR KECAMATAN */}
              <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg> Data Kecamatan</p>
                 <div className="grid grid-cols-2 gap-2">
                    {kecamatanData?.features.map((k, i) => (
                       <button key={i} onClick={() => {
                         // SET EFEK HIGHLIGHT BIRU KETIKA DIKLIK
                         setActiveKecamatanId(k.properties.id_kecamatan);
                         
                         const center = L.geoJSON(k).getBounds().getCenter();
                         mapInstance.flyTo(center, 14, {animate: true});
                         handleKlikKecamatan(k.properties.id_kecamatan, k.properties.nama_kecamatan, center);
                       }} className="text-[11px] font-bold text-gray-600 bg-white border border-gray-200 py-2.5 px-3 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all text-left truncate shadow-sm">
                          {k.properties.nama_kecamatan}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg> Kalkulator Jarak Halte</p>
                <div className="flex gap-2 mb-3">
                   <button onClick={() => setMeasureMode(measureMode === 'A' ? null : 'A')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all shadow-sm ${measureMode === 'A' ? 'bg-indigo-600 text-white border-indigo-600 scale-95' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>Pilih Titik A</button>
                   <button onClick={() => setMeasureMode(measureMode === 'B' ? null : 'B')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all shadow-sm ${measureMode === 'B' ? 'bg-pink-600 text-white border-pink-600 scale-95' : 'bg-white text-pink-600 border-pink-200 hover:bg-pink-50'}`}>Pilih Titik B</button>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2"><span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-extrabold">A</span><span className="text-xs font-medium text-gray-700 truncate">{measureStart ? measureStart.nama : "Belum dipilih..."}</span></div>
                  <div className="flex items-center gap-2"><span className="bg-pink-100 text-pink-600 text-[10px] px-2 py-0.5 rounded font-extrabold">B</span><span className="text-xs font-medium text-gray-700 truncate">{measureEnd ? measureEnd.nama : "Belum dipilih..."}</span></div>
                </div>
                {measureResult && (
                  <div className="bg-indigo-600 text-white p-3 rounded-lg text-center shadow-lg shadow-indigo-200 mt-2">
                    <p className="text-[10px] uppercase tracking-widest font-medium opacity-80 mb-0.5">Jarak Udara (ST_Distance)</p>
                    <p className="text-xl font-black">{measureResult.jarak_km} KM <span className="text-sm font-medium opacity-80">({measureResult.jarak_meter} m)</span></p>
                  </div>
                )}
                {(measureStart || measureEnd) && (<button onClick={() => {setMeasureStart(null); setMeasureEnd(null); setMeasureResult(null); setMeasureMode(null);}} className="w-full mt-3 text-[11px] text-gray-500 hover:text-red-500 font-bold uppercase tracking-widest">Reset Pengukuran</button>)}
              </div>

              <div className="flex items-center gap-3 opacity-50">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Radius Area</span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>
              <button onClick={() => setIsSelectingPoint(!isSelectingPoint)} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${isSelectingPoint ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 shadow-sm'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {isSelectingPoint ? 'Batalkan Pemilihan Titik' : 'Pilih Pusat Radius di Peta'}
              </button>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Radius Buffer</label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{radiusMeter} m</span>
              </div>
              <input type="range" min="100" max="5000" step="100" className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" value={radiusMeter} onChange={(e) => setRadiusMeter(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={handleCariRadius} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-blue-600/30">Mulai Analisis</button>
                <button onClick={handleClearRadius} className="bg-white hover:bg-gray-50 text-gray-600 font-bold py-3 px-5 rounded-xl text-sm border border-gray-200">Reset</button>
              </div>

              {/* HASIL RADIUS */}
              {intersectData?.features?.length > 0 && (
                 <div className="mt-2 border border-blue-100 rounded-xl bg-blue-50 px-5 py-4">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">ST_Intersects</p>
                    <p className="text-sm font-medium text-blue-900 leading-snug">Ditemukan <span className="font-extrabold">{intersectData.features.length} Rute</span> yang memotong area.</p>
                 </div>
              )}
              {radiusData?.features && radiusData.features.length >= 0 && (
                 <div className="mt-2 border border-green-100 rounded-xl overflow-hidden">
                   <div className="bg-green-50 px-5 py-3.5 border-b border-green-100 flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                     <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">ST_DWithin (Halte)</p>
                   </div>
                   <div className="max-h-48 overflow-y-auto bg-white">
                     {radiusData.features.length === 0 ? (
                       <div className="px-5 py-4 text-xs font-bold text-gray-400 text-center">Tidak ada lokasi dalam jangkauan</div>
                     ) : (
                       radiusData.features.map((f, i) => (
                         <div key={i} className="px-5 py-3 text-[13px] font-medium text-gray-700 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50">
                           <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div><span className="truncate">{f.properties.nama_halte}</span>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
              )}
            </div>
          ) : isAdmin ? (
            <div className="animate-in fade-in space-y-4">
               <div className="flex bg-slate-100 p-1.5 rounded-xl border border-gray-200/60 mb-4">
                  <button onClick={() => setAdminTab('halte')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adminTab === 'halte' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Kelola Halte</button>
                  <button onClick={() => setAdminTab('rute')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adminTab === 'rute' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Kelola Rute</button>
               </div>
               
               {adminTab === 'halte' ? (
                  <form onSubmit={handleSimpanHalte} className="space-y-4">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-2.5 mb-2">
                      <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed">{editHalteId ? "Mode EDIT. Ubah data di bawah lalu simpan." : "Mode TAMBAH. Ketuk peta untuk mengisi koordinat."}</p>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nama Halte</label><input type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none" value={formHalte.nama_halte} onChange={e => setFormHalte({...formHalte, nama_halte: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Alamat Jalan</label><input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none" value={formHalte.alamat} onChange={e => setFormHalte({...formHalte, alamat: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Tipe Halte</label><select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formHalte.tipe_halte} onChange={e => setFormHalte({...formHalte, tipe_halte: e.target.value})}><option value="Shelter">Shelter BRT</option><option value="Bus Stop">Bus Stop</option></select></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Fasilitas</label><input type="text" placeholder="Atap, Kursi..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formHalte.fasilitas} onChange={e => setFormHalte({...formHalte, fasilitas: e.target.value})} /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Rute Terhubung</label><input type="text" placeholder="Contoh: 1A, 2, 6B" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formHalte.rute_terhubung} onChange={e => setFormHalte({...formHalte, rute_terhubung: e.target.value})} /></div>
                    <div className="flex gap-4 pt-2">
                      <div className="w-1/2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Latitude</label><input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[12px] font-mono text-gray-500" value={formHalte.lat} /></div>
                      <div className="w-1/2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Longitude</label><input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[12px] font-mono text-gray-500" value={formHalte.lon} /></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editHalteId && <button type="button" onClick={() => {setEditHalteId(null); setFormHalte({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter', fasilitas: '', rute_terhubung: '', lat: '', lon: '' })}} className="w-1/3 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl text-sm hover:bg-gray-200 transition-all">Batal</button>}
                      <button type="submit" className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all">{editHalteId ? 'Simpan Perubahan' : 'Upload Halte'}</button>
                    </div>
                  </form>
               ) : (
                  <form onSubmit={handleSimpanRute} className="space-y-4">
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex items-start gap-2.5 mb-2">
                      <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      <div className="text-[11px] text-gray-600 font-medium leading-relaxed">
                         <p className="font-bold text-amber-700 mb-1">{editRuteId ? "Mode EDIT Rute Aktif" : "Cara Menggambar Rute:"}</p>
                         {editRuteId ? "Ubah detail informasi atau klik peta untuk menambah titik rute baru." : "Klik titik-titik di peta secara berurutan untuk membentuk garis jalur."} <br/>
                         {newRoutePoints.length > 0 && <span className="text-emerald-600 font-bold mt-1 block">✓ {newRoutePoints.length} Titik Koordinat Terekam</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Kode Trayek</label><input type="text" required placeholder="Ex: 4F" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formRute.kode_rute} onChange={e => setFormRute({...formRute, kode_rute: e.target.value})} /></div>
                       <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Jenis Armada</label><select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formRute.jenis_angkutan} onChange={e => setFormRute({...formRute, jenis_angkutan: e.target.value})}><option value="TransJakarta">TransJakarta</option><option value="Mikrotrans">Mikrotrans</option></select></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nama Panjang Rute</label><input type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formRute.nama_rute} onChange={e => setFormRute({...formRute, nama_rute: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Warna Garis</label><input type="color" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl p-1 outline-none cursor-pointer" value={formRute.warna_jalur} onChange={e => setFormRute({...formRute, warna_jalur: e.target.value})} /></div>
                       <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Jam Operasi</label><input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formRute.jam_operasional} onChange={e => setFormRute({...formRute, jam_operasional: e.target.value})} /></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editRuteId && <button type="button" onClick={() => {setEditRuteId(null); setNewRoutePoints([]); setFormRute({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' })}} className="w-1/3 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl text-sm hover:bg-gray-200 transition-all">Batal</button>}
                      {newRoutePoints.length > 0 && <button type="button" onClick={() => setNewRoutePoints([])} className="w-1/3 bg-red-50 text-red-600 font-bold py-3.5 rounded-xl text-sm hover:bg-red-100 transition-all">Hapus Garis</button>}
                      <button type="submit" className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all">{editRuteId ? 'Simpan Perubahan' : 'Simpan Rute Baru'}</button>
                    </div>
                  </form>
               )}
            </div>
          ) : null}
        </div>
      </div>

      {/* STATISTIK KANAN ATAS (UI ORIGINAL FIGO) */}
      <div className="absolute top-5 right-5 z-[1000] flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 overflow-hidden pointer-events-auto">
        <div className="px-6 py-3.5 border-r border-gray-100 flex flex-col justify-center bg-gray-50/50">
           <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sistem Waktu</span>
           <span className="text-sm font-mono font-bold text-gray-700">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="px-6 py-3.5 border-r border-gray-100 flex flex-col justify-center items-center">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Halte</span>
          <span className="text-lg font-black text-gray-800 leading-none">{halteData?.features.length || 0}</span>
        </div>
        <div className="px-6 py-3.5 flex flex-col justify-center items-center">
           <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Rute</span>
           <span className="text-lg font-black text-blue-600 leading-none">{ruteData?.features.length || 0}</span>
        </div>
      </div>

      {/* TOMBOL RECENTER DITUMPUK DI ATAS ZOOM CONTROL */}
      <div style={{ position: 'absolute', bottom: '85px', right: '10px', zIndex: 1000 }} className="flex flex-col items-end pointer-events-none">
        <button onClick={handleRecenter} className="bg-white w-[34px] h-[34px] flex items-center justify-center rounded-[4px] shadow-[0_1px_5px_rgba(0,0,0,0.65)] text-gray-600 hover:text-[#1a73e8] hover:bg-gray-50 transition-colors pointer-events-auto" title="Pusatkan Layar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      {/* MENU PILIHAN PETA (TEMA) */}
      <div className="absolute bottom-6 left-5 z-[1000] flex flex-col justify-end items-start pointer-events-none">
        <div className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 overflow-hidden flex flex-col font-medium text-xs text-gray-700 transition-all duration-300 transform origin-bottom-left mb-3 w-48 ${isLayerMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="p-3 bg-gray-50/80 border-b border-gray-100 font-bold text-[10px] uppercase tracking-widest text-gray-500 flex justify-between items-center">
             Tema Peta
             <button onClick={() => setIsLayerMenuOpen(false)} className="text-gray-400 hover:text-red-500">✖</button>
          </div>
          <button onClick={() => {setMapType('modern'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'modern' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>Kanvas Modern</button>
          <button onClick={() => {setMapType('osm'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'osm' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>Peta Klasik OSM</button>
          <button onClick={() => {setMapType('terrain'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'terrain' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>Topografi Fisik</button>
          <button onClick={() => {setMapType('satelit'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'satelit' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>Satelit Bumi</button>
          <button onClick={() => {setMapType('dark'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'dark' ? 'bg-slate-800 text-white font-bold border-l-4 border-slate-700' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>Peta Mode Gelap</button>
        </div>
        <button onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)} className="bg-white/90 backdrop-blur-md p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 text-gray-600 hover:text-blue-600 hover:scale-105 transition-all flex items-center justify-center pointer-events-auto cursor-pointer">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
        </button>
      </div>

      {/* MINIMAP RADAR */}
      {mapInstance && <Minimap mainMap={mapInstance} mapUrl={MAP_LAYERS[mapType]} />}

      {/* MAP ENGINE PUSAT */}
      <MapContainer center={[-6.225, 106.90]} zoom={13} zoomControl={false} attributionControl={false} className="w-full h-full z-0" ref={setMapInstance}>
        <TileLayer url={MAP_LAYERS[mapType]} />
        <ZoomControl position="bottomright" />
        <MapEvents />

        {/* --- LAYER KECAMATAN (DENGAN EFEK BIRU MENYALA) --- */}
        {kecamatanData && (
          <GeoJSON 
            key={`layer-kecamatan-${mapType}`}
            data={kecamatanData} 
            style={(f) => {
              // Jika ID kecamatan ini cocok dengan state yang sedang di-klik, buat dia BIRU!
              const isActive = f.properties.id_kecamatan === activeKecamatanId;
              return {
                color: isActive ? '#3b82f6' : (mapType === 'dark' ? '#94a3b8' : '#64748b'),
                weight: isActive ? 3 : 1.5,
                fillColor: isActive ? '#3b82f6' : '#94a3b8',
                fillOpacity: isActive ? 0.2 : 0.05,
                dashArray: '4, 4'
              };
            }}
            onEachFeature={(f, l) => {
              l.on({
                mouseover: (e) => { 
                  // Kalau lagi nyala biru, jangan ditimpa warnanya saat di-hover
                  if (f.properties.id_kecamatan !== activeKecamatanId) {
                    e.target.setStyle({ fillOpacity: 0.1, color: '#3b82f6', weight: 2.5 }); 
                  }
                },
                mouseout: (e) => { 
                  // Kalau lagi nyala biru, biarkan dia tetap biru saat mouse pergi
                  if (f.properties.id_kecamatan !== activeKecamatanId) {
                    e.target.setStyle({ fillOpacity: 0.05, color: mapType === 'dark' ? '#94a3b8' : '#64748b', weight: 1.5 }); 
                  }
                }
                // FUNGSI KLIK TIDAK ADA AGAR TIDAK GANGGU. 
                // Klik hanya lewat menu sebelah kiri.
              });
            }}
          />
        )}

        {/* 2. LAYER PENGUKURAN JARAK */}
        {measureStart && measureEnd && (
          <Polyline positions={[[measureStart.lat, measureStart.lon], [measureEnd.lat, measureEnd.lon]]} color="#4f46e5" weight={5} dashArray="10, 10" opacity={0.8} />
        )}

        {/* 3. PREVIEW ADMIN RUTE */}
        {newRoutePoints.length > 0 && (
          <Polyline positions={newRoutePoints.map(p => [p[1], p[0]])} color={formRute.warna_jalur} weight={6} dashArray="8, 12" />
        )}

        {/* 4. LAYER RUTE ANGKUTAN */}
        {ruteData && <GeoJSON 
          key={`rute-${selectedRouteCode}-${intersectData ? '1' : '0'}`} 
          data={ruteData} 
          style={(f) => {
            const isSelected = f.properties.kode_rute === selectedRouteCode;
            const isIntersected = intersectedRuteCodes.includes(f.properties.kode_rute);
            return {
              color: isSelected ? '#f59e0b' : (isIntersected ? '#ef4444' : (f.properties.warna_jalur || '#1a73e8')), 
              weight: isSelected || isIntersected ? 8 : 4,
              opacity: isSelected || isIntersected ? 1 : 0.75
            };
          }} 
          onEachFeature={(f, l) => {
            const p = f.properties;
            const btnEditRute = isAdmin ? `<button onclick="window.editRute(${p.id_rute}, '${p.kode_rute}', '${p.jenis_angkutan}', '${p.nama_rute.replace(/'/g, "\\'")}', '${p.rute_awal}', '${p.rute_akhir}', '${p.jam_operasional}', '${p.warna_jalur}', ${JSON.stringify(f.geometry.coordinates)})" class="flex-1 bg-blue-50 text-blue-600 border border-blue-100 font-bold py-2.5 rounded-lg text-xs hover:bg-blue-100">Edit Rute</button>` : '';
            const btnHapusRute = isAdmin ? `<button onclick="window.hapusRute(${p.id_rute})" class="flex-1 bg-red-50 text-red-600 border border-red-100 font-bold py-2.5 rounded-lg text-xs hover:bg-red-100">Hapus Rute</button>` : '';
            const adminRuteControls = isAdmin ? `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">${btnEditRute}${btnHapusRute}</div>` : '';

            l.bindPopup(`
              <div class="font-sans w-[240px] p-1.5">
                <div class="mb-4">
                  <h4 class="font-extrabold text-gray-800 text-[15px] leading-tight mb-1.5">${p.nama_rute}</h4>
                  <span class="inline-block bg-blue-50 text-blue-600 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest border border-blue-100">${p.kode_rute}</span>
                </div>
                <div id="loading-panjang-${p.kode_rute}" class="text-[11px] text-gray-500 mt-2 mb-3 italic flex items-center gap-1.5">Menghitung jarak spasial...</div>
                <div id="hasil-panjang-${p.kode_rute}" class="hidden bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-[11px] font-bold border border-emerald-100 mb-3"></div>
                <div class="space-y-2.5 text-[12px] text-gray-600 border-t border-gray-100 pt-3.5">
                  <div class="flex justify-between"><span class="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Metode Angkut</span><span class="font-bold text-gray-800">${p.jenis_angkutan || '-'}</span></div>
                  <div class="flex justify-between"><span class="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Jam Operasi</span><span class="font-bold text-gray-800">${p.jam_operasional || '-'}</span></div>
                </div>
                ${adminRuteControls}
              </div>
            `);
            l.on('click', async function() {
              setSelectedRouteCode(p.kode_rute); setSelectedHalteId(null); this.bringToFront(); 
              try {
                const res = await axios.get(`${API_URL}/analisis/panjang-rute/${p.kode_rute}`);
                document.getElementById(`loading-panjang-${p.kode_rute}`).style.display = 'none';
                const divHasil = document.getElementById(`hasil-panjang-${p.kode_rute}`);
                divHasil.style.display = 'block'; divHasil.innerHTML = `Estimasi Jarak (ST_Length): <br/><span class="text-sm text-emerald-900">${res.data.panjang_km} Kilometer</span>`;
              } catch(e) {}
            });
          }} 
        />}

        {/* 5. LAYER HALTE */}
        {halteData && halteData.features.filter(f => !highlightedHalteIds.includes(f.properties.id_halte)).map((f, idx) => {
          const p = f.properties;
          const latlng = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
          const isSelected = p.id_halte === selectedHalteId;
          
          const btnEdit = isAdmin ? `<button onclick="window.editHalte(${p.id_halte}, '${p.nama_halte.replace(/'/g, "\\'")}', '${p.alamat_jalan || ''}', '${p.tipe_halte}', '${p.fasilitas_shelter}', '${p.rute_terhubung || ''}', ${latlng[0]}, ${latlng[1]})" class="flex-1 bg-blue-50 text-blue-600 border border-blue-100 font-bold py-2.5 rounded-lg text-xs hover:bg-blue-100">Edit Data</button>` : '';
          const btnHapus = isAdmin ? `<button onclick="window.hapusHalte(${p.id_halte})" class="flex-1 bg-red-50 text-red-600 border border-red-100 font-bold py-2.5 rounded-lg text-xs hover:bg-red-100">Hapus</button>` : '';
          const adminControls = isAdmin ? `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">${btnEdit}${btnHapus}</div>` : '';

          return (
            <Marker key={`halte-marker-${p.id_halte}-${isSelected}`} position={latlng} icon={isSelected ? iconSelected : iconDefault} eventHandlers={{
                click: (e) => {
                  const mode = measureModeRef.current;
                  if (mode === 'A') { window.setTitikA(p.id_halte, p.nama_halte, latlng[0], latlng[1]); setTimeout(() => e.target.closePopup(), 10); } 
                  else if (mode === 'B') { window.setTitikB(p.id_halte, p.nama_halte, latlng[0], latlng[1]); setTimeout(() => e.target.closePopup(), 10); } 
                  else { setSelectedHalteId(p.id_halte); setSelectedRouteCode(null); }
                }
              }}>
              <Popup>
                <div className="font-sans min-w-[240px] p-1.5">
                  <div className="mb-3">
                    <h4 className="font-extrabold text-gray-800 text-[15px] leading-tight mb-1">{p.nama_halte}</h4>
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">ID: {p.id_halte}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug mb-3 pb-3 border-b border-gray-100">{p.alamat_jalan || 'Data lokasi fisik tidak tersimpan'}</p>
                  <div className="space-y-2.5 text-[12px] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Tipe</span><span className="font-bold text-gray-700 capitalize">{p.tipe_halte || '-'}</span></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Fasilitas</span><span className="font-bold text-gray-700">{p.fasilitas_shelter || '-'}</span></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Rute</span><span className="font-bold text-[#1a73e8]">{p.rute_terhubung || '-'}</span></div>
                  </div>
                  {isAdmin && <div dangerouslySetInnerHTML={{ __html: adminControls }} />}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 6. LAYER HALTE AREA RADIUS (Warna Merah) */}
        {radiusData && radiusData.features.map((f, idx) => {
           const p = f.properties;
           const latlng = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
           return (
             <Marker key={`radius-marker-${p.id_halte}`} position={latlng} icon={iconRadius}>
               <Popup>
                  <div className="font-sans min-w-[240px] p-1.5">
                    <div className="text-red-500 font-extrabold text-[10px] mb-2.5 uppercase tracking-widest">Radius Evaluasi ST_DWithin</div>
                    <div className="mb-3">
                      <h4 className="font-extrabold text-gray-800 text-[15px] leading-tight mb-1">{p.nama_halte}</h4>
                      <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">ID: {p.id_halte}</span>
                    </div>
                    <div className="space-y-2.5 text-[12px] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Tipe</span><span className="font-bold text-gray-700 capitalize">{p.tipe_halte || '-'}</span></div>
                      <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Rute</span><span className="font-bold text-[#1a73e8]">{p.rute_terhubung || '-'}</span></div>
                    </div>
                  </div>
               </Popup>
             </Marker>
           )
        })}

        {/* RADIUS CIRCLE */}
        {searchPoint && <Circle center={searchPoint} radius={radiusMeter} pathOptions={{ fillColor: '#1a73e8', color: '#1a73e8', weight: 2, fillOpacity: 0.1, dashArray: '6, 6' }} />}
      </MapContainer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
        .leaflet-popup-content-wrapper { border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #f3f4f6; padding: 4px; }
        .leaflet-popup-content { margin: 12px; }
        .leaflet-container a.leaflet-popup-close-button { top: 12px; right: 12px; color: #9ca3af; font-weight: bold; }
        .custom-div-icon { background: none; border: none; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce { animation: bounce 0.8s infinite ease-in-out; }
      `}</style>
    </div>
  );
}