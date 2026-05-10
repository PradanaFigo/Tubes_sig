from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, cast, text
from geoalchemy2 import Geography
from pydantic import BaseModel
from fastapi.responses import JSONResponse
import json
import hashlib
import traceback

import models, schemas
from database import engine, get_db

# Sinkronisasi model ke database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WebGIS Transportasi API",
    description="API untuk manajemen data Halte dan Rute Angkutan Umum dengan format GeoJSON.",
    version="3.0.0"
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
    existing_user = db.query(models.Admin).filter(models.Admin.username == data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    
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
    admin = db.query(models.Admin).filter(models.Admin.username == data.username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Username tidak ditemukan")
    
    if admin.password != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Password salah")
    
    return {"message": "Login berhasil", "id_admin": admin.id_admin, "username": admin.username}

# ==========================================
# 2. ENDPOINTS: HALTE (Full CRUD)
# ==========================================
@app.post("/api/halte")
def create_halte(halte: schemas.HalteCreate, db: Session = Depends(get_db)):
    try:
        point_wkt = f"SRID=4326;POINT({halte.lon} {halte.lat})"
        
        db_halte = models.Halte(
            nama_halte=halte.nama_halte,
            alamat_jalan=halte.alamat_jalan,
            tipe_halte=halte.tipe_halte,
            rute_terhubung=halte.rute_terhubung,
            fasilitas_shelter=halte.fasilitas_shelter,
            id_admin=halte.id_admin if hasattr(halte, 'id_admin') and halte.id_admin else 1, 
            geom=func.ST_GeomFromEWKT(point_wkt)
        )
        db.add(db_halte)
        db.commit()
        return {"message": "Data Halte berhasil ditambahkan"}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e.__dict__.get('orig', e))}")

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

@app.put("/api/halte/{id_halte}")
def update_halte(id_halte: int, data: schemas.HalteUpdate, db: Session = Depends(get_db)):
    try:
        halte = db.query(models.Halte).filter(models.Halte.id_halte == id_halte).first()
        if not halte:
            raise HTTPException(status_code=404, detail="Halte tidak ditemukan")
        
        if data.nama_halte is not None: halte.nama_halte = data.nama_halte
        if data.alamat_jalan is not None: halte.alamat_jalan = data.alamat_jalan
        if data.tipe_halte is not None: halte.tipe_halte = data.tipe_halte
        if data.rute_terhubung is not None: halte.rute_terhubung = data.rute_terhubung
        if data.fasilitas_shelter is not None: halte.fasilitas_shelter = data.fasilitas_shelter
        
        if data.lat is not None and data.lon is not None:
            point_wkt = f"SRID=4326;POINT({data.lon} {data.lat})"
            halte.geom = func.ST_GeomFromEWKT(point_wkt)

        db.commit()
        return {"message": "Data Halte berhasil diperbarui"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e.__dict__.get('orig', e)))

@app.delete("/api/halte/{id_halte}")
def delete_halte(id_halte: int, db: Session = Depends(get_db)):
    halte = db.query(models.Halte).filter(models.Halte.id_halte == id_halte).first()
    if not halte:
        raise HTTPException(status_code=404, detail="Halte tidak ditemukan")
    
    db.delete(halte)
    db.commit()
    return {"message": "Halte berhasil dihapus"}

# ==========================================
# 3. ENDPOINTS: RUTE (Full CRUD)
# ==========================================
@app.post("/api/rute")
def create_rute(data: schemas.RuteCreate, db: Session = Depends(get_db)):
    try:
        geom_data = func.ST_SetSRID(func.ST_GeomFromGeoJSON(data.geojson_geom), 4326)
        
        db_rute = models.Rute(
            kode_rute=data.kode_rute,
            jenis_angkutan=data.jenis_angkutan,
            nama_rute=data.nama_rute,
            rute_awal=data.rute_awal,
            rute_akhir=data.rute_akhir,
            jam_operasional=data.jam_operasional,
            warna_jalur=data.warna_jalur,
            id_admin=data.id_admin if hasattr(data, 'id_admin') and data.id_admin else 1,
            geom=geom_data
        )
        db.add(db_rute)
        db.commit()
        return {"message": "Data Rute berhasil ditambahkan"}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e.__dict__.get('orig', e))}")

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

@app.put("/api/rute/{id_rute}")
def update_rute(id_rute: int, data: schemas.RuteUpdate, db: Session = Depends(get_db)):
    try:
        rute = db.query(models.Rute).filter(models.Rute.id_rute == id_rute).first()
        if not rute:
            raise HTTPException(status_code=404, detail="Rute tidak ditemukan")
        
        if data.kode_rute is not None: rute.kode_rute = data.kode_rute
        if data.jenis_angkutan is not None: rute.jenis_angkutan = data.jenis_angkutan
        if data.nama_rute is not None: rute.nama_rute = data.nama_rute
        if data.rute_awal is not None: rute.rute_awal = data.rute_awal
        if data.rute_akhir is not None: rute.rute_akhir = data.rute_akhir
        if data.jam_operasional is not None: rute.jam_operasional = data.jam_operasional
        if data.warna_jalur is not None: rute.warna_jalur = data.warna_jalur
        
        if data.geojson_geom is not None:
            rute.geom = func.ST_SetSRID(func.ST_GeomFromGeoJSON(data.geojson_geom), 4326)

        db.commit()
        return {"message": "Data Rute berhasil diperbarui"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e.__dict__.get('orig', e)))

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

@app.get("/api/analisis/rute-intersect")
def cari_rute_intersect(lat: float, lon: float, radius_meter: float = 1000, db: Session = Depends(get_db)):
    titik_pusat = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    area_lingkaran = func.ST_Buffer(cast(titik_pusat, Geography), radius_meter)
    
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

@app.get("/api/analisis/jarak-halte/{id_halte_1}/{id_halte_2}")
def hitung_jarak_antar_halte(id_halte_1: int, id_halte_2: int, db: Session = Depends(get_db)):
    Halte1 = aliased(models.Halte)
    Halte2 = aliased(models.Halte)

    hasil = db.query(
        Halte1.nama_halte.label("nama_halte_1"),
        Halte2.nama_halte.label("nama_halte_2"),
        func.ST_Distance(
            cast(Halte1.geom, Geography), 
            cast(Halte2.geom, Geography)
        ).label("jarak_meter")
    ).filter(
        Halte1.id_halte == id_halte_1, 
        Halte2.id_halte == id_halte_2
    ).first()

    if not hasil:
        raise HTTPException(status_code=404, detail="Salah satu atau kedua halte tidak ditemukan")

    return {
        "halte_1": hasil.nama_halte_1,
        "halte_2": hasil.nama_halte_2,
        "jarak_meter": round(hasil.jarak_meter, 2),
        "jarak_km": round(hasil.jarak_meter / 1000, 2)
    }

# ==========================================
# 5. ENDPOINTS: WILAYAH ADMINISTRASI (KECAMATAN)
# ==========================================
@app.get("/api/kecamatan")
def get_kecamatan(db: Session = Depends(get_db)):
    query = text("""
        SELECT 
            id, 
            name AS nama_kecamatan, 
            ST_AsGeoJSON(geom::geometry)::json AS geometry 
        FROM kecamatan_jaktim_polygon
        WHERE name IS NOT NULL
    """)
    result = db.execute(query).fetchall()
    
    features = []
    for row in result:
        features.append({
            "type": "Feature",
            "properties": {"id_kecamatan": row.id, "nama_kecamatan": row.nama_kecamatan},
            "geometry": row.geometry
        })
    return {"type": "FeatureCollection", "features": features}

# ==========================================
# 6. ENDPOINT: STATISTIK SPASIAL KECAMATAN
# ==========================================
@app.get("/api/analisis/statistik-kecamatan/{id_kecamatan:path}")
def statistik_kecamatan(id_kecamatan: str, db: Session = Depends(get_db)):
    kec = db.execute(text("SELECT name FROM kecamatan_jaktim_polygon WHERE id = :id"), {"id": id_kecamatan}).first()
    if not kec:
        raise HTTPException(status_code=404, detail="Kecamatan tidak ditemukan")
    
    q_halte = text("""
        SELECT COUNT(*) FROM tabel_halte_final h
        WHERE ST_Intersects(
            ST_Transform(ST_SetSRID(h.geom::geometry, 4326), 4326),
            (SELECT ST_Transform(ST_SetSRID(geom::geometry, 4326), 4326) 
             FROM kecamatan_jaktim_polygon WHERE id = :id)
        )
    """)
    jml_halte = db.execute(q_halte, {"id": id_kecamatan}).scalar()

    q_rute = text("""
        SELECT COUNT(DISTINCT r.id_rute) FROM tabel_rute_final r
        WHERE ST_Intersects(
            ST_Transform(ST_SetSRID(r.geom::geometry, 4326), 4326),
            (SELECT ST_Transform(ST_SetSRID(geom::geometry, 4326), 4326) 
             FROM kecamatan_jaktim_polygon WHERE id = :id)
        )
    """)
    jml_rute = db.execute(q_rute, {"id": id_kecamatan}).scalar()

    return {
        "id_kecamatan": id_kecamatan,
        "nama_kecamatan": kec.name if kec.name else "Area",
        "jumlah_halte": jml_halte or 0,
        "jumlah_rute": jml_rute or 0
    }