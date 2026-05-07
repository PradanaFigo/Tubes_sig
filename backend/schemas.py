from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

# ==========================================
# SCHEMA HALTE
# ==========================================
class HalteCreate(BaseModel):
    nama_halte: str
    alamat_jalan: Optional[str] = None
    tipe_halte: Optional[str] = "platform"
    rute_terhubung: Optional[str] = None
    fasilitas_shelter: Optional[str] = "yes"
    id_admin: int = 1  # Otomatis masuk ke admin_utama
    lat: float = Field(..., description="Latitude titik halte")
    lon: float = Field(..., description="Longitude titik halte")

class HalteUpdate(BaseModel):
    nama_halte: Optional[str] = None
    alamat_jalan: Optional[str] = None
    tipe_halte: Optional[str] = None
    rute_terhubung: Optional[str] = None
    fasilitas_shelter: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None

# ==========================================
# SCHEMA RUTE
# ==========================================
class RuteCreate(BaseModel):
    kode_rute: str
    jenis_angkutan: str
    nama_rute: str
    rute_awal: str
    rute_akhir: str
    warna_jalur: Optional[str] = "#000000"
    jam_operasional: Optional[str] = "05:00-22:00"
    id_admin: int = 1  # Otomatis masuk ke admin_utama
    # Menggunakan geojson_geom agar sinkron dengan output React Leaflet Draw
    geojson_geom: str = Field(..., description="String GeoJSON dari LineString Rute")

class RuteUpdate(BaseModel):
    kode_rute: Optional[str] = None
    jenis_angkutan: Optional[str] = None
    nama_rute: Optional[str] = None
    rute_awal: Optional[str] = None
    rute_akhir: Optional[str] = None
    jam_operasional: Optional[str] = None
    warna_jalur: Optional[str] = None
    geojson_geom: Optional[str] = None

# ==========================================
# SCHEMA OUTPUT GEOJSON
# ==========================================
class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]