from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from geoalchemy2 import Geography
import json

import models, schemas
from database import engine, get_db

# Sinkronisasi model ke database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WebGIS Transportasi Jakarta Timur API",
    description="API untuk manajemen data Halte dan Rute Angkutan Umum dengan format GeoJSON.",
    version="1.0.0"
)

# CORS Middleware agar Frontend ReactJS bisa mengakses API ini tanpa ditolak
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. ENDPOINTS: HALTE (CRUD)
# ==========================================

@app.post("/api/halte", response_model=dict)
def create_halte(halte: schemas.HalteCreate, db: Session = Depends(get_db)):
    point_wkt = f"SRID=4326;POINT({halte.lon} {halte.lat})"
    
    db_halte = models.Halte(
        nama_halte=halte.nama_halte,
        alamat_jalan=halte.alamat_jalan,
        tipe_halte=halte.tipe_halte,
        rute_terhubung=halte.rute_terhubung,
        fasilitas_shelter=halte.fasilitas_shelter,
        id_admin=halte.id_admin,
        geom=func.ST_GeomFromEWKT(point_wkt)
    )
    db.add(db_halte)
    db.commit()
    return {"message": "Data Halte berhasil ditambahkan"}

@app.get("/api/halte", response_model=schemas.GeoJSONFeatureCollection)
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
# 2. ENDPOINTS: RUTE (Read & Delete)
# ==========================================

@app.get("/api/rute", response_model=schemas.GeoJSONFeatureCollection)
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
# 3. ENDPOINTS: ANALISIS SPASIAL
# ==========================================

# A. ST_DWithin: Cari Halte terdekat dalam radius meter
@app.get("/api/analisis/halte-terdekat", response_model=schemas.GeoJSONFeatureCollection)
def cari_halte_terdekat(lat: float, lon: float, radius_meter: float = 500, db: Session = Depends(get_db)):
    search_point = f"SRID=4326;POINT({lon} {lat})"
    
    results = db.query(models.Halte, func.ST_AsGeoJSON(models.Halte.geom).label('geojson')).filter(
        func.ST_DWithin(
            cast(models.Halte.geom, Geography), 
            cast(func.ST_GeomFromEWKT(search_point), Geography), 
            radius_meter
        )
    ).all()
    
    if not results:
        raise HTTPException(status_code=404, detail=f"Tidak ditemukan halte dalam radius {radius_meter} meter")

    features = []
    for h, g in results:
        if g:
            features.append({
                "type": "Feature", 
                "geometry": json.loads(g), 
                "properties": {
                    "id_halte": h.id_halte,
                    "nama_halte": h.nama_halte,
                    "rute_terhubung": h.rute_terhubung
                }
            })
    return {"type": "FeatureCollection", "features": features}

# B. ST_Intersects: Cari Rute yang melewati buffer 100m dari titik
@app.get("/api/analisis/rute-bersinggungan")
def cari_rute_lewat_sini(lat: float, lon: float, db: Session = Depends(get_db)):
    search_area = f"SRID=4326;POINT({lon} {lat})"
    
    results = db.query(models.Rute).filter(
        func.ST_Intersects(
            cast(models.Rute.geom, Geography),
            func.ST_Buffer(cast(func.ST_GeomFromEWKT(search_area), Geography), 100)
        )
    ).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="Tidak ada rute yang melewati titik ini")

    data_rute = [{"kode": r.kode_rute, "nama": r.nama_rute, "jenis": r.jenis_angkutan} for r in results]
    return {"rute_ditemukan": data_rute}