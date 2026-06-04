import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, GeoJSON, Circle, CircleMarker, useMapEvents, ZoomControl, Polyline, Marker, Popup, Rectangle, useMap, useMapEvent } from 'react-leaflet';
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

// --- KOMPONEN MINIMAP ---
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
    <div style={{ position: 'absolute', bottom: '24px', right: '70px', width: '160px', height: '160px', zIndex: 1000 }} className="bg-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto transition-all duration-300 hover:scale-105 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] group">
      <MapContainer center={mainMap.getCenter()} zoom={10} zoomControl={false} attributionControl={false} dragging={false} doubleClickZoom={false} scrollWheelZoom={false} touchZoom={false} style={{ backgroundColor: '#0f172a' }} className="w-full h-full cursor-crosshair">
        <TileLayer url={mapUrl} />
        <MinimapInner mainMap={mainMap} />
      </MapContainer>
      <div className="absolute bottom-0 left-0 w-full bg-slate-950 text-center py-1.5 text-[10px] font-black text-slate-400 tracking-widest z-[1001] pointer-events-none group-hover:bg-emerald-600 group-hover:text-white transition-colors uppercase border-t border-slate-800">MINIMAP</div>
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
  
  // STATE FILTER TAMPILAN PETA (BARU DITAMBAHKAN KEMBALI)
  const [showHalte, setShowHalte] = useState(true);
  const [showRute, setShowRute] = useState(true);
  const [kategoriOptions, setKategoriOptions] = useState([]);
  const [selectedKategori, setSelectedKategori] = useState("Semua");

  const [searchPoint, setSearchPoint] = useState(null);
  const [radiusMeter, setRadiusMeter] = useState(1000);
  const [activeTab, setActiveTab] = useState('analisis');
  const [adminTab, setAdminTab] = useState('halte'); 
  const [isSelectingPoint, setIsSelectingPoint] = useState(false);
  
  const [selectedRouteCode, setSelectedRouteCode] = useState(null);
  const [selectedHalteId, setSelectedHalteId] = useState(null);
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
  const [formHalte, setFormHalte] = useState({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter BRT', fasilitas: '', rute_terhubung: '', lat: '', lon: '' });

  const [editRuteId, setEditRuteId] = useState(null);
  const [formRute, setFormRute] = useState({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' });
  const [newRoutePoints, setNewRoutePoints] = useState([]); 
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapType, setMapType] = useState('modern');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [userLocation, setUserLocation] = useState(null);

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latlng = [latitude, longitude];
        setUserLocation(latlng);
        if (mapInstance) {
          mapInstance.flyTo(latlng, 16, { animate: true, duration: 1.5 });
        }
      },
      () => {
        alert("Gagal mendapatkan lokasi. Pastikan izin GPS diberikan di browser.");
      }
    );
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchKategoriOptions();
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
    fetchRute(selectedKategori);
    fetchHalte(selectedKategori);

    setSelectedRouteCode(null);
    setSelectedHalteId(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [selectedKategori]);

  useEffect(() => {
    if (measureStart && measureEnd) {
      axios.get(`${API_URL}/analisis/jarak-halte/${measureStart.id}/${measureEnd.id}`)
        .then(res => setMeasureResult(res.data)).catch(err => alert("Gagal mengukur jarak antar halte."));
    }
  }, [measureStart, measureEnd]);

  const fetchKategoriOptions = async () => {
    try {
      const res = await axios.get(`${API_URL}/kategori-rute`);
      setKategoriOptions(res.data);
    } catch (e) {
      console.error("Gagal mengambil kategori rute:", e);
    }
  };

  const fetchRute = async (kategori = selectedKategori) => {
    try {
      const params =
        kategori === "Semua"
          ? ""
          : `?kategori=${encodeURIComponent(kategori)}`;

      const res = await axios.get(`${API_URL}/rute/filter${params}`);
      setRuteData(res.data);
    } catch (e) {
      console.error("Gagal mengambil data rute:", e);
    }
  };

  const fetchHalte = async (kategori = selectedKategori) => {
    try {
      const params =
        kategori === "Semua"
          ? ""
          : `?kategori=${encodeURIComponent(kategori)}`;

      const res = await axios.get(`${API_URL}/halte/filter${params}`);
      setHalteData(res.data);
    } catch (e) {
      console.error("Gagal mengambil data halte:", e);
    }
  };

  const fetchKecamatan = async () => { try { const res = await axios.get(`${API_URL}/kecamatan`); setKecamatanData(res.data); } catch (e) {} };

  const handleKlikKecamatan = async (id, nama, latlng) => {
    if (isSelectingPoint || (activeTab === 'tambah' && isAdmin)) return;

    const popup = L.popup({ className: 'custom-popup' })
      .setLatLng(latlng)
      .setContent(`<div class="p-2 text-center text-[11px] font-bold text-gray-500 italic">Menganalisis area Kec. ${nama}...</div>`)
      .openOn(mapInstance);

    try {
      const res = await axios.get(`${API_URL}/analisis/statistik-kecamatan/${id}`);
      const data = res.data;

      popup.setContent(`
        <div class="font-sans min-w-[200px] p-1.5 text-center">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Statistik Spasial Wilayah</span>
          <h4 class="font-extrabold text-gray-800 text-[16px] leading-tight mb-3">Kec. ${data.nama_kecamatan}</h4>
          <div class="grid grid-cols-2 gap-2 mb-1">
            <div class="bg-blue-50 border border-blue-100 py-2.5 px-2 rounded-xl shadow-sm">
              <span class="block text-2xl font-black text-blue-600 leading-none mb-1">${data.jumlah_halte}</span>
              <span class="text-[9px] font-extrabold text-blue-500 uppercase tracking-widest">Titik Halte</span>
            </div>
            <div class="bg-amber-50 border border-amber-100 py-2.5 px-2 rounded-xl shadow-sm">
              <span class="block text-2xl font-black text-amber-500 leading-none mb-1">${data.jumlah_rute}</span>
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
      const payload = {
        nama_halte: formHalte.nama_halte,
        alamat_jalan: formHalte.alamat || "",       
        tipe_halte: formHalte.tipe_halte || "Shelter BRT",
        rute_terhubung: formHalte.rute_terhubung || "",
        fasilitas_shelter: formHalte.fasilitas || "", 
        lat: parseFloat(formHalte.lat),             
        lon: parseFloat(formHalte.lon),             
        id_admin: 1                                 
      };

      if (isNaN(payload.lat) || isNaN(payload.lon)) {
        return alert("Klik pada peta untuk mendapatkan titik koordinat latitude & longitude terlebih dahulu!");
      }

      if (editHalteId) { 
        await axios.put(`${API_URL}/halte/${editHalteId}`, payload); 
        alert("Data Halte berhasil diperbarui!"); 
      } else { 
        await axios.post(`${API_URL}/halte`, payload); 
        alert("Data Halte berhasil ditambahkan!"); 
      }
      
      fetchHalte(); 
      setEditHalteId(null);
      setFormHalte({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter BRT', fasilitas: '', rute_terhubung: '', lat: '', lon: '' });
    } catch (e) { 
      let errMsg = e.response?.data?.detail || e.message;
      if (typeof errMsg !== 'string') errMsg = JSON.stringify(errMsg);
      alert(`GAGAL MENYIMPAN HALTE!\n\nAlasan: ${errMsg}\n\nPastikan di Database (tabel admin_users) sudah ada admin dengan id_admin = 1!`);
      console.error(e); 
    }
  };

  const handleSimpanRute = async (e) => {
    e.preventDefault();
    if (newRoutePoints.length < 2) return alert("Gambarkan rute di peta minimal 2 titik koordinat!");
    
    const payload = { 
      kode_rute: formRute.kode_rute,
      jenis_angkutan: formRute.jenis_angkutan || "TransJakarta",
      nama_rute: formRute.nama_rute,
      rute_awal: formRute.rute_awal || "",
      rute_akhir: formRute.rute_akhir || "",
      jam_operasional: formRute.jam_operasional || "05:00-22:00",
      warna_jalur: formRute.warna_jalur || "#1a73e8",
      geojson_geom: JSON.stringify({ type: "LineString", coordinates: newRoutePoints }),
      id_admin: 1 
    };

    try {
      if (editRuteId) { 
        await axios.put(`${API_URL}/rute/${editRuteId}`, payload); 
        alert("Data Rute berhasil diperbarui!"); 
      } else { 
        await axios.post(`${API_URL}/rute`, payload); 
        alert("Data Rute berhasil ditambahkan!"); 
      }
      fetchRute(); 
      setEditRuteId(null); setNewRoutePoints([]);
      setFormRute({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' });
    } catch (e) { 
      let errMsg = e.response?.data?.detail || e.message;
      if (typeof errMsg !== 'string') errMsg = JSON.stringify(errMsg);
      alert(`GAGAL MENYIMPAN RUTE!\n\nAlasan: ${errMsg}`);
      console.error(e); 
    }
  };

  const handleRecenter = () => { if (mapInstance) mapInstance.setView([-6.225, 106.90], 13, {animate: true}); };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
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
    <div className="w-full h-screen bg-slate-950 font-sans text-slate-100 flex flex-col overflow-hidden relative">
      
      {/* MODAL AUTENTIKASI */}
      {showAuthModal && (
        <div className="absolute inset-0 z-[9999] bg-slate-950/80 flex items-center justify-center backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[360px] overflow-hidden">
            <div className="flex bg-slate-950/50 border-b border-slate-800">
              <button onClick={() => setIsRegisterMode(false)} className={`flex-1 py-4 text-sm font-bold transition-colors ${!isRegisterMode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}>Masuk Admin</button>
              <button onClick={() => setIsRegisterMode(true)} className={`flex-1 py-4 text-sm font-bold transition-colors ${isRegisterMode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}>Daftar Admin</button>
            </div>
            <form onSubmit={handleAuth} className="p-6">
              <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">ID Pengguna</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Kata Sandi</label><input type="password" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-sm transition-colors">Batal</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">{isRegisterMode ? 'Daftar' : 'Masuk'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVBAR GLOBAL (Sama dengan Landing Page) */}
      <div className="w-full h-4 z-[60] drop-shadow-lg shrink-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='20' viewBox='0 0 60 20'%3E%3Cpolygon points='0,0 15,20 30,0' fill='%23fbbf24' /%3E%3Cpolygon points='30,0 45,20 60,0' fill='%2310b981' /%3E%3C/svg%3E")`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}></div>
      <nav className="w-full z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 h-16 shrink-0 flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
          <span className="font-bold text-xl tracking-tight text-white">TransJakarta <span className="text-amber-400">Timur</span></span>
        </div>
        <div className="flex space-x-6 items-center">
          <button onClick={() => window.location.href = '/'} className="text-slate-300 hover:text-amber-400 text-sm font-medium transition-colors hidden sm:block">Kembali ke Beranda</button>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAuthModal(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg text-sm font-bold transition-all border border-slate-700">
            {isAdmin ? 'Keluar Mode Admin' : 'Login Admin'}
          </button>
        </div>
      </nav>

      {/* CONTAINER BAWAH (SIDEBAR + MAP) */}
      <div className="flex-1 flex overflow-hidden relative">

      {/* TOMBOL BUKA SIDEBAR DIPINDAH KE TENGAH */}

      {/* MAIN DASHBOARD PANEL (Sleek Floating Island) */}
      <div className={`absolute top-4 left-4 bottom-4 z-[1002] w-[400px] bg-slate-900/95 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5),_inset_0_1px_0_rgba(255,255,255,0.1)] rounded-2xl border border-slate-700/50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${isPanelOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
        
        {/* Unsur Budaya Gigi Balang */}
        <div className="h-4 w-full bg-slate-950 border-b border-slate-800" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='20' viewBox='0 0 60 20'%3E%3Cpolygon points='0,0 15,20 30,0' fill='%23fbbf24' /%3E%3Cpolygon points='30,0 45,20 60,0' fill='%2310b981' /%3E%3C/svg%3E")`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%', backgroundPosition: 'top left' }}></div>

        <div className={`px-6 py-5 border-b border-slate-800/50 flex justify-between items-center bg-slate-950/30`}>
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            </div>
            <div>
              <h1 className={`text-[18px] font-extrabold leading-tight text-white tracking-tight`}>TransJakarta <span className="text-amber-400">Explorer</span></h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 text-slate-400`}>{isAdmin ? 'Administrator Panel' : 'Peta Interaktif'}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAuthModal(true)} className={`rounded-xl p-2 transition-all text-slate-400 hover:text-emerald-400 bg-slate-800/50 hover:bg-slate-800`}>
              {isAdmin ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
            </button>
            <button onClick={() => setIsPanelOpen(false)} className={`rounded-xl p-2 transition-all text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800`}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-800/50 bg-slate-950/50 shrink-0">
          <button onClick={() => setActiveTab('analisis')} className={`flex-1 py-3.5 text-xs font-extrabold uppercase tracking-widest transition-all ${activeTab === 'analisis' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50' : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-400'}`}>Eksplorasi</button>
          {isAdmin && <button onClick={() => setActiveTab('tambah')} className={`flex-1 py-3.5 text-xs font-extrabold uppercase tracking-widest transition-all ${activeTab === 'tambah' ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50' : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-400'}`}>Manajemen Data</button>}
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-transparent no-scrollbar relative">
          {activeTab === 'analisis' ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="relative z-50">
                <div className="flex items-center bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 focus-within:border-emerald-500 focus-within:bg-slate-900 transition-all shadow-inner">
                  <svg className="w-4 h-4 text-slate-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <input type="text" placeholder="Telusuri Halte & Rute..." className="w-full bg-transparent text-sm outline-none font-medium text-white placeholder-slate-500" value={searchQuery} onChange={handleSearchInput} />
                  {searchQuery && <button onClick={() => {setSearchQuery(''); setSearchResults([]); setSelectedRouteCode(null); setSelectedHalteId(null);}} className="text-slate-500 hover:text-red-400 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>}
                </div>

                {/* --- FILTER TAMPILAN PETA --- */}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowHalte(!showHalte)} className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${showHalte ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}>
                    <div className={`w-2 h-2 rounded-full ${showHalte ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}></div> Halte
                  </button>
                  <button onClick={() => setShowRute(!showRute)} className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${showRute ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-sm' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}>
                    <div className={`w-2 h-2 rounded-full ${showRute ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-slate-600'}`}></div> Rute
                  </button>
                </div>

                {/* --- FILTER KATEGORI ANGKUTAN --- */}
                <div className="mt-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Filter Jenis Angkutan
                  </label>

                  <select
                    value={selectedKategori}
                    onChange={(e) => setSelectedKategori(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-300 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Semua">Semua Kategori</option>

                    {kategoriOptions.map((item) => (
                      <option
                        key={item.kategori_layanan}
                        value={item.kategori_layanan}
                        className="bg-slate-900 text-slate-200"
                      >
                        {item.kategori_layanan} ({item.jumlah_kode_rute_unik} rute, {item.jumlah_halte} halte)
                      </option>
                    ))}
                  </select>
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[300px] overflow-y-auto no-scrollbar">
                    {searchResults.map((item, idx) => (
                      <button key={idx} onClick={() => handleSelectSearchResult(item)} className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800 transition-colors flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg shrink-0 ${item.resultType === 'halte' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-white truncate">{item.resultType === 'halte' ? item.properties.nama_halte : item.properties.nama_rute}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{item.resultType === 'halte' ? 'Titik Lokasi' : `Kode: ${item.properties.kode_rute}`}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* MENU DAFTAR KECAMATAN */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 shadow-inner">
                 <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg> Data Kecamatan</p>
                 <div className="grid grid-cols-2 gap-2">
                    {kecamatanData?.features.map((k, i) => (
                       <button key={i} onClick={() => {
                         setActiveKecamatanId(k.properties.id_kecamatan);
                         const center = L.geoJSON(k).getBounds().getCenter();
                         mapInstance.flyTo(center, 14, {animate: true});
                         handleKlikKecamatan(k.properties.id_kecamatan, k.properties.nama_kecamatan, center);
                       }} className="text-[11px] font-bold text-slate-300 bg-slate-900/50 border border-slate-700/50 py-2.5 px-3 rounded-xl hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-left truncate shadow-sm">
                          {k.properties.nama_kecamatan}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 shadow-inner">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg> Kalkulator Jarak Halte</p>
                <div className="flex gap-2 mb-4">
                   <button onClick={() => setMeasureMode(measureMode === 'A' ? null : 'A')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all shadow-sm ${measureMode === 'A' ? 'bg-emerald-600 text-white border-emerald-500 scale-95' : 'bg-slate-900/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:border-emerald-500/30'}`}>Pilih Titik A</button>
                   <button onClick={() => setMeasureMode(measureMode === 'B' ? null : 'B')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all shadow-sm ${measureMode === 'B' ? 'bg-emerald-600 text-white border-emerald-500 scale-95' : 'bg-slate-900/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:border-emerald-500/30'}`}>Pilih Titik B</button>
                </div>
                <div className="space-y-3 mb-4 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3"><span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 w-6 h-6 flex items-center justify-center text-[10px] rounded-lg font-extrabold">A</span><span className="text-xs font-medium text-slate-300 truncate">{measureStart ? measureStart.nama : "Belum dipilih..."}</span></div>
                  <div className="flex items-center gap-3"><span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 w-6 h-6 flex items-center justify-center text-[10px] rounded-lg font-extrabold">B</span><span className="text-xs font-medium text-slate-300 truncate">{measureEnd ? measureEnd.nama : "Belum dipilih..."}</span></div>
                </div>
                {measureResult && (
                  <div className="bg-slate-900 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-center shadow-[0_0_15px_rgba(16,185,129,0.1)] mt-2">
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">Jarak Udara (ST_Distance)</p>
                    <p className="text-xl font-black text-white">{measureResult.jarak_km} KM <span className="text-sm font-medium text-emerald-500">({measureResult.jarak_meter} m)</span></p>
                  </div>
                )}
                {(measureStart || measureEnd) && (<button onClick={() => {setMeasureStart(null); setMeasureEnd(null); setMeasureResult(null); setMeasureMode(null);}} className="w-full mt-4 text-[11px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-widest">Reset Pengukuran</button>)}
              </div>

              <div className="flex items-center gap-3 opacity-50 my-2">
                <div className="h-px bg-slate-700 flex-1"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Radius Area</span>
                <div className="h-px bg-slate-700 flex-1"></div>
              </div>

              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 shadow-inner space-y-4">
                <button onClick={() => setIsSelectingPoint(!isSelectingPoint)} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${isSelectingPoint ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' : 'bg-slate-900/50 text-emerald-400 hover:bg-slate-800 border-slate-700 hover:border-emerald-500/50 shadow-sm'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {isSelectingPoint ? 'Batalkan Pemilihan Titik' : 'Pilih Pusat Radius di Peta'}
                </button>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Radius Buffer</label>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">{radiusMeter} m</span>
                </div>
                <input type="range" min="100" max="5000" step="100" className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500" value={radiusMeter} onChange={(e) => setRadiusMeter(e.target.value)} />
                <div className="flex gap-3">
                  <button onClick={handleCariRadius} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-[0_4px_15px_rgba(16,185,129,0.3)]">Mulai Analisis</button>
                  <button onClick={handleClearRadius} className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-3.5 px-6 rounded-xl text-sm border border-slate-700">Reset</button>
                </div>

                {/* HASIL RADIUS */}
                {intersectData?.features?.length > 0 && (
                   <div className="mt-4 border border-emerald-500/30 rounded-xl bg-slate-900 px-5 py-4">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1.5">ST_Intersects</p>
                      <p className="text-sm font-medium text-slate-300 leading-snug">Ditemukan <span className="font-extrabold text-emerald-400">{intersectData.features.length} Rute</span> yang memotong area.</p>
                   </div>
                )}
                {radiusData?.features && radiusData.features.length >= 0 && (
                   <div className="mt-3 border border-slate-700/80 rounded-xl overflow-hidden shadow-inner">
                     <div className="bg-slate-900/80 px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
                       <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                       <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">ST_DWithin (Halte)</p>
                     </div>
                     <div className="max-h-48 overflow-y-auto bg-slate-950/50 no-scrollbar">
                       {radiusData.features.length === 0 ? (
                         <div className="px-5 py-5 text-xs font-bold text-slate-500 text-center">Tidak ada lokasi dalam jangkauan</div>
                       ) : (
                       radiusData.features.map((f, i) => (
                         <div key={i} className="px-5 py-3 text-[13px] font-medium text-slate-300 border-b border-slate-800/50 last:border-0 flex items-center gap-3 hover:bg-slate-800 transition-colors">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div><span className="truncate">{f.properties.nama_halte}</span>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
              )}
              </div>
            </div>
          ) : isAdmin ? (
            <div className="animate-in fade-in space-y-4">
               <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 mb-4">
                  <button onClick={() => setAdminTab('halte')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adminTab === 'halte' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Kelola Halte</button>
                  <button onClick={() => setAdminTab('rute')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${adminTab === 'rute' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Kelola Rute</button>
               </div>
               
               {adminTab === 'halte' ? (
                  <form onSubmit={handleSimpanHalte} className="space-y-4">
                    <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20 flex items-start gap-2.5 mb-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <p className="text-[11px] text-emerald-200/80 font-medium leading-relaxed">{editHalteId ? "Mode EDIT. Ubah data di bawah lalu simpan." : "Mode TAMBAH. Ketuk peta untuk mengisi koordinat."}</p>
                    </div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nama Halte</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none text-white transition-colors" value={formHalte.nama_halte} onChange={e => setFormHalte({...formHalte, nama_halte: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Alamat Jalan</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none text-white transition-colors" value={formHalte.alamat} onChange={e => setFormHalte({...formHalte, alamat: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Tipe Halte</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-emerald-500 transition-colors" value={formHalte.tipe_halte} onChange={e => setFormHalte({...formHalte, tipe_halte: e.target.value})}><option value="Shelter">Shelter BRT</option><option value="Bus Stop">Bus Stop</option></select></div>
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Fasilitas</label><input type="text" placeholder="Atap, Kursi..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-emerald-500 transition-colors" value={formHalte.fasilitas} onChange={e => setFormHalte({...formHalte, fasilitas: e.target.value})} /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Rute Terhubung</label><input type="text" placeholder="Contoh: 1A, 2, 6B" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-emerald-500 transition-colors" value={formHalte.rute_terhubung} onChange={e => setFormHalte({...formHalte, rute_terhubung: e.target.value})} /></div>
                    <div className="flex gap-4 pt-2">
                      <div className="w-1/2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Latitude</label><input type="text" readOnly className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[12px] font-mono text-slate-500" value={formHalte.lat} /></div>
                      <div className="w-1/2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Longitude</label><input type="text" readOnly className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[12px] font-mono text-slate-500" value={formHalte.lon} /></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editHalteId && <button type="button" onClick={() => {setEditHalteId(null); setFormHalte({ kode_halte: '', nama_halte: '', alamat: '', tipe_halte: 'Shelter', fasilitas: '', rute_terhubung: '', lat: '', lon: '' })}} className="w-1/3 bg-slate-800 text-slate-300 font-bold py-3.5 rounded-xl text-sm hover:bg-slate-700 transition-all">Batal</button>}
                      <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">{editHalteId ? 'Simpan Perubahan' : 'Upload Halte'}</button>
                    </div>
                  </form>
               ) : (
                  <form onSubmit={handleSimpanRute} className="space-y-4">
                    <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/20 flex items-start gap-2.5 mb-2">
                      <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      <div className="text-[11px] text-amber-200/80 font-medium leading-relaxed">
                         <p className="font-bold text-amber-400 mb-1">{editRuteId ? "Mode EDIT Rute Aktif" : "Cara Menggambar Rute:"}</p>
                         {editRuteId ? "Ubah detail informasi atau klik peta untuk menambah titik rute baru." : "Klik titik-titik di peta secara berurutan untuk membentuk garis jalur."} <br/>
                         {newRoutePoints.length > 0 && <span className="text-emerald-400 font-bold mt-1 block">✓ {newRoutePoints.length} Titik Koordinat Terekam</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Kode Trayek</label><input type="text" required placeholder="Ex: 4F" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-amber-500 transition-colors" value={formRute.kode_rute} onChange={e => setFormRute({...formRute, kode_rute: e.target.value})} /></div>
                       <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Jenis Armada</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-amber-500 transition-colors" value={formRute.jenis_angkutan} onChange={e => setFormRute({...formRute, jenis_angkutan: e.target.value})}><option value="TransJakarta">TransJakarta</option><option value="Mikrotrans">Mikrotrans</option></select></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nama Panjang Rute</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-amber-500 transition-colors" value={formRute.nama_rute} onChange={e => setFormRute({...formRute, nama_rute: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Warna Garis</label><div className="flex gap-2"><input type="color" className="w-10 h-10 rounded shrink-0 cursor-pointer bg-slate-950 border border-slate-800" value={formRute.warna_jalur} onChange={e => setFormRute({...formRute, warna_jalur: e.target.value})} /><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white uppercase focus:border-amber-500 transition-colors" value={formRute.warna_jalur} onChange={e => setFormRute({...formRute, warna_jalur: e.target.value})} /></div></div>
                       <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Jam Operasi</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-white focus:border-amber-500 transition-colors" value={formRute.jam_operasional} onChange={e => setFormRute({...formRute, jam_operasional: e.target.value})} /></div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {editRuteId && <button type="button" onClick={() => {setEditRuteId(null); setFormRute({ kode_rute: '', jenis_angkutan: 'TransJakarta', nama_rute: '', rute_awal: '', rute_akhir: '', jam_operasional: '05:00-22:00', warna_jalur: '#1a73e8' }); setNewRoutePoints([]);}} className="w-1/3 bg-slate-800 text-slate-300 font-bold py-3.5 rounded-xl text-sm hover:bg-slate-700 transition-all">Batal</button>}
                      <button type="submit" className="flex-1 bg-amber-600 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-amber-900/20 hover:bg-amber-500 transition-all">{editRuteId ? 'Simpan Perubahan' : 'Upload Rute'}</button>
                    </div>
                  </form>
               )}
            </div>
          ) : null}
        </div>
      </div>

      {/* MAP AREA CONTAINER */}
      <div className="flex-1 relative bg-slate-900">
        
        {/* TOMBOL TOGGLE SIDEBAR (Nempel Kiri Tengah) */}
        <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-1/2 left-0 -translate-y-1/2 z-[1000] bg-slate-900/90 backdrop-blur-md p-1.5 py-4 rounded-r-xl border border-slate-700/50 border-l-0 text-slate-400 hover:text-emerald-400 shadow-[10px_0_20px_rgba(0,0,0,0.5)] hover:bg-slate-800 transition-all focus:outline-none" title="Toggle Panel">
          <svg className={`w-5 h-5 transition-transform duration-300 ${isPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>

      {/* STATISTIK MENYATU KANAN ATAS */}
      <div className="absolute top-5 right-5 z-[1000] flex bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden pointer-events-auto">
        <div className="px-6 py-3.5 border-r border-slate-700 flex flex-col justify-center bg-slate-950/40">
           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Sistem Waktu</span>
           <span className="text-sm font-mono font-bold text-white">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="px-6 py-3.5 border-r border-slate-700 flex flex-col justify-center items-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Halte</span>
          <span className="text-lg font-black text-white leading-none">{halteData?.features.length || 0}</span>
        </div>
        <div className="px-6 py-3.5 flex flex-col justify-center items-center">
           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Rute</span>
           <span className="text-lg font-black text-amber-400 leading-none">{ruteData?.features.length || 0}</span>
        </div>
      </div>

      {/* TOMBOL RECENTER DITUMPUK DI ATAS ZOOM CONTROL */}
      <div style={{ position: 'absolute', bottom: '100px', right: '20px', zIndex: 1000 }} className="flex flex-col items-end pointer-events-none">
        <button onClick={handleRecenter} className="bg-slate-900/90 backdrop-blur-md w-[34px] h-[34px] flex items-center justify-center rounded-[8px] shadow-[0_4px_15px_rgba(0,0,0,0.3)] text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-700/50 transition-colors pointer-events-auto" title="Pusatkan Layar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      {/* MENU PILIHAN PETA (TEMA) */}
      <div className="absolute bottom-6 left-5 z-[1000] flex flex-col justify-end items-start pointer-events-none">
        <div className={`bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col font-medium text-xs text-slate-300 transition-all duration-300 transform origin-bottom-left mb-3 w-48 ${isLayerMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 font-bold text-[10px] uppercase tracking-widest text-slate-500 flex justify-between items-center">
             Tema Peta
             <button onClick={() => setIsLayerMenuOpen(false)} className="text-slate-400 hover:text-red-500">✖</button>
          </div>
          <button onClick={() => {setMapType('modern'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'modern' ? 'bg-slate-800 text-amber-400 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-800/50 border-l-4 border-transparent'}`}>Kanvas Modern</button>
          <button onClick={() => {setMapType('osm'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'osm' ? 'bg-slate-800 text-amber-400 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-800/50 border-l-4 border-transparent'}`}>Peta Klasik OSM</button>
          <button onClick={() => {setMapType('terrain'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'terrain' ? 'bg-slate-800 text-amber-400 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-800/50 border-l-4 border-transparent'}`}>Topografi Fisik</button>
          <button onClick={() => {setMapType('satelit'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'satelit' ? 'bg-slate-800 text-amber-400 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-800/50 border-l-4 border-transparent'}`}>Satelit Bumi</button>
          <button onClick={() => {setMapType('dark'); setIsLayerMenuOpen(false);}} className={`px-4 py-3 text-left transition-colors flex items-center gap-3 ${mapType === 'dark' ? 'bg-slate-800 text-emerald-400 font-bold border-l-4 border-emerald-500' : 'hover:bg-slate-800/50 border-l-4 border-transparent'}`}>Peta Mode Gelap</button>
        </div>
        <button onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)} className="bg-slate-900/90 backdrop-blur-md p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-700/50 text-slate-400 hover:text-amber-400 hover:scale-105 transition-all flex items-center justify-center pointer-events-auto cursor-pointer" title="Ubah Tema Peta">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
        </button>
      </div>

      {/* TOMBOL LOKASI SAYA (GPS) */}
      <div className="absolute bottom-6 left-[84px] z-[1000]">
        <button onClick={handleLocateUser} className="bg-slate-900/90 backdrop-blur-md p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-700/50 text-slate-400 hover:text-amber-400 hover:scale-105 transition-all flex items-center justify-center cursor-pointer" title="Lokasi Saya">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12h3m12 0h3M12 3v3m0 12v3m0-12a6 6 0 110 12 6 6 0 010-12z"></path></svg>
        </button>
      </div>

      {/* MINIMAP RADAR */}
      {mapInstance && <Minimap mainMap={mapInstance} mapUrl={MAP_LAYERS[mapType]} />}

      {/* MAP ENGINE PUSAT */}
      <MapContainer center={[-6.225, 106.90]} zoom={13} zoomControl={false} attributionControl={false} className="w-full h-full z-0" ref={setMapInstance}>
        <TileLayer url={MAP_LAYERS[mapType]} detectRetina={true} />
        <ZoomControl position="bottomright" />
        <MapEvents />

        {/* --- LAYER KECAMATAN DENGAN HIGHLIGHT BIRU --- */}
        {kecamatanData && (
          <GeoJSON 
            key={`layer-kecamatan-${mapType}`}
            data={kecamatanData} 
            style={(f) => {
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
                  if (f.properties.id_kecamatan !== activeKecamatanId) {
                    e.target.setStyle({ fillOpacity: 0.1, color: '#3b82f6', weight: 2.5 }); 
                  }
                },
                mouseout: (e) => { 
                  if (f.properties.id_kecamatan !== activeKecamatanId) {
                    e.target.setStyle({ fillOpacity: 0.05, color: mapType === 'dark' ? '#94a3b8' : '#64748b', weight: 1.5 }); 
                  }
                }
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

        {/* 4. LAYER RUTE ANGKUTAN (BERDASARKAN FILTER) */}
        {showRute && ruteData && <GeoJSON 
          key={`rute-${selectedKategori}-${selectedRouteCode}-${intersectData ? '1' : '0'}`} 
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
                  <div class="flex justify-between"><span class="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Kategori</span><span class="font-bold text-gray-800">${p.kategori_layanan || '-'}</span></div>
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

        {/* 5. LAYER HALTE (BERDASARKAN FILTER) */}
        {showHalte && halteData && halteData.features.filter(f => !highlightedHalteIds.includes(f.properties.id_halte)).map((f, idx) => {
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
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Kategori</span><span className="font-bold text-emerald-600">{p.kategori_layanan || '-'}</span></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Validasi</span><span className="font-bold text-gray-700">{p.status_validasi || '-'}</span></div>
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

        {/* LOKASI SAYA MARKER */}
        {userLocation && (
          <Marker position={userLocation} icon={new L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="w-5 h-5 bg-blue-500 border-4 border-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })}>
            <Popup>
               <div className="font-bold text-sm text-center">Lokasi Anda Saat Ini</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      </div>
      </div>

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