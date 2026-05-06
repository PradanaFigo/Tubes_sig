from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from geoalchemy2 import Geography
from pydantic import BaseModel
import json
import hashlib

import models, schemas
from database import engine, get_db

# Sinkronisasi model ke database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WebGIS Transportasi API",
    description="API untuk manajemen data Halte dan Rute Angkutan Umum dengan format GeoJSON.",
    version="2.0.0"
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 0. SCHEMA UNTUK LOGIN & REGISTER
# ==========================================
class AdminAuth(BaseModel):
    username: str
    password: str

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

# ==========================================
# 1. ENDPOINTS: AUTHENTICATION (AKUN ADMIN)
# ==========================================

@app.post("/api/auth/register")
def register_admin(data: AdminAuth, db: Session = Depends(get_db)):
    # Cek apakah username sudah ada
    existing_user = db.query(models.Admin).filter(models.Admin.username == data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    
    # Buat admin baru
    new_admin = models.Admin(
        username=data.username,
        password=hash_password(data.password)
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return {"message": "Akun admin berhasil dibuat", "id_admin": new_admin.id_admin}

@app.post("/api/auth/login")
def login_admin(data: AdminAuth, db: Session = Depends(get_db)):
    # Cari user berdasarkan username
    admin = db.query(models.Admin).filter(models.Admin.username == data.username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Username tidak ditemukan")
    
    # Verifikasi password
    if admin.password != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Password salah")
    
    return {"message": "Login berhasil", "id_admin": admin.id_admin, "username": admin.username}


# ==========================================
# 2. ENDPOINTS: HALTE (CRUD)
# ==========================================

@app.post("/api/halte")
def create_halte(halte: schemas.HalteCreate, db: Session = Depends(get_db)):
    point_wkt = f"SRID=4326;POINT({halte.lon} {halte.lat})"
    
    db_halte = models.Halte(
        nama_halte=halte.nama_halte,
        alamat_jalan=halte.alamat_jalan,
        tipe_halte=halte.tipe_halte,
        rute_terhubung=halte.rute_terhubung,
        fasilitas_shelter=halte.fasilitas_shelter,
        id_admin=halte.id_admin if hasattr(halte, 'id_admin') else 1, # Default admin jika kosong
        geom=func.ST_GeomFromEWKT(point_wkt)
    )
    db.add(db_halte)
    db.commit()
    return {"message": "Data Halte berhasil ditambahkan"}

@app.get("/api/halte")
def get_semua_halte(db: Session = Depends(get_db)):
    results = db.query(models.Halte, func.ST_AsGeoJSON(models.Halte.geom).label('geojson')).all()
    
    features = []
    for h, geojson_geom in results:
        if not geojson_geom:
            continue
        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson_geom),
            "properties": {
                "id_halte": h.id_halte,
                "nama_halte": h.nama_halte,
                "alamat_jalan": h.alamat_jalan,
                "tipe_halte": h.tipe_halte,
                "rute_terhubung": h.rute_terhubung,
                "fasilitas_shelter": h.fasilitas_shelter,
                "id_admin": h.id_admin
            }
        })
    return {"type": "FeatureCollection", "features": features}

@app.delete("/api/halte/{id_halte}")
def delete_halte(id_halte: int, db: Session = Depends(get_db)):
    halte = db.query(models.Halte).filter(models.Halte.id_halte == id_halte).first()
    if not halte:
        raise HTTPException(status_code=404, detail="Halte tidak ditemukan")
    
    db.delete(halte)
    db.commit()
    return {"message": "Halte berhasil dihapus"}

# ==========================================
# 3. ENDPOINTS: RUTE (Read & Delete)
# ==========================================

@app.get("/api/rute")
def get_semua_rute(db: Session = Depends(get_db)):
    results = db.query(models.Rute, func.ST_AsGeoJSON(models.Rute.geom).label('geojson')).all()
    
    features = []
    for r, geojson_geom in results:
        if not geojson_geom:
            continue
        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson_geom),
            "properties": {
                "id_rute": r.id_rute,
                "kode_rute": r.kode_rute,
                "jenis_angkutan": r.jenis_angkutan,
                "nama_rute": r.nama_rute,
                "rute_awal": r.rute_awal,
                "rute_akhir": r.rute_akhir,
                "warna_jalur": r.warna_jalur,
                "jam_operasional": r.jam_operasional,
                "id_admin": r.id_admin
            }
        })
    return {"type": "FeatureCollection", "features": features}

@app.delete("/api/rute/{id_rute}")
def delete_rute(id_rute: int, db: Session = Depends(get_db)):
    rute = db.query(models.Rute).filter(models.Rute.id_rute == id_rute).first()
    if not rute:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")
    
    db.delete(rute)
    db.commit()
    return {"message": "Rute berhasil dihapus"}

# ==========================================
# 4. ENDPOINTS: ANALISIS SPASIAL
# ==========================================

# A. ST_DWithin (Mencari Halte Terdekat)
@app.get("/api/analisis/halte-terdekat")
def cari_halte_terdekat(lat: float, lon: float, radius_meter: float = 1000, db: Session = Depends(get_db)):
    search_point = f"SRID=4326;POINT({lon} {lat})"
    
    results = db.query(models.Halte, func.ST_AsGeoJSON(models.Halte.geom).label('geojson')).filter(
        func.ST_DWithin(
            cast(models.Halte.geom, Geography), 
            cast(func.ST_GeomFromEWKT(search_point), Geography), 
            radius_meter
        )
    ).all()
    
    features = []
    for h, g in results:
        if g:
            features.append({
                "type": "Feature", 
                "geometry": json.loads(g), 
                "properties": {
                    "id_halte": h.id_halte,
                    "nama_halte": h.nama_halte,
                    "alamat_jalan": h.alamat_jalan,
                    "tipe_halte": h.tipe_halte,
                    "rute_terhubung": h.rute_terhubung
                }
            })
    return {"type": "FeatureCollection", "features": features}

# B. ST_Intersects (Mencari Rute yang Memotong Radius)
@app.get("/api/analisis/rute-intersect")
def cari_rute_intersect(lat: float, lon: float, radius_meter: float = 1000, db: Session = Depends(get_db)):
    # Membuat Polygon lingkaran (Buffer) dari titik pusat
    titik_pusat = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    area_lingkaran = func.ST_Buffer(cast(titik_pusat, Geography), radius_meter)
    
    # Mencari rute yang memotong (ST_Intersects) area lingkaran tersebut
    results = db.query(models.Rute, func.ST_AsGeoJSON(models.Rute.geom).label('geojson')).filter(
        func.ST_Intersects(models.Rute.geom, cast(area_lingkaran, models.Rute.geom.type))
    ).all()
    
    features = []
    for r, g in results:
        if g:
            features.append({
                "type": "Feature", 
                "geometry": json.loads(g), 
                "properties": {
                    "kode_rute": r.kode_rute,
                    "nama_rute": r.nama_rute,
                    "jenis_angkutan": r.jenis_angkutan
                }
            })
    return {"type": "FeatureCollection", "features": features}

# C. ST_Length (Menghitung Panjang Jalur)
@app.get("/api/analisis/panjang-rute/{kode_rute}")
def hitung_panjang_rute(kode_rute: str, db: Session = Depends(get_db)):
    hasil = db.query(
        models.Rute.nama_rute,
        func.ST_Length(cast(models.Rute.geom, Geography)).label("panjang_meter")
    ).filter(models.Rute.kode_rute == kode_rute).first()

    if not hasil:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")

    return {
        "kode_rute": kode_rute,
        "nama_rute": hasil.nama_rute,
        "panjang_km": round(hasil.panjang_meter / 1000, 2)
    }