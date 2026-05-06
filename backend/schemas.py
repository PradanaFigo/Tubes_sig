from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class HalteCreate(BaseModel):
    nama_halte: str
    alamat_jalan: Optional[str] = None
    tipe_halte: Optional[str] = "platform"
    rute_terhubung: Optional[str] = None
    fasilitas_shelter: Optional[str] = "yes"
    id_admin: int = 1  # Otomatis masuk ke admin_utama
    lat: float = Field(..., description="Latitude titik halte")
    lon: float = Field(..., description="Longitude titik halte")

class RuteCreate(BaseModel):
    kode_rute: str
    jenis_angkutan: str
    nama_rute: str
    rute_awal: str
    rute_akhir: str
    warna_jalur: Optional[str] = "#000000"
    jam_operasional: Optional[str] = "05:00-22:00"
    id_admin: int = 1  # Otomatis masuk ke admin_utama
    koordinat: List[List[float]] = Field(..., description="Array koordinat [[lon, lat], [lon, lat]]")

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]