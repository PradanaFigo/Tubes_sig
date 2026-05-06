from sqlalchemy import Column, Integer, String, ForeignKey
from geoalchemy2 import Geometry
from database import Base

# Tabel 1: Admin
class Admin(Base):
    __tablename__ = "admin_users"
    
    id_admin = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(255), nullable=False)

# Tabel 2: Halte
class Halte(Base):
    __tablename__ = "tabel_halte_final" 
    
    id_halte = Column(Integer, primary_key=True, index=True)
    nama_halte = Column(String, nullable=False)
    alamat_jalan = Column(String)
    tipe_halte = Column(String)
    rute_terhubung = Column(String)
    fasilitas_shelter = Column(String)
    
    id_admin = Column(Integer, ForeignKey("admin_users.id_admin"))
    geom = Column(Geometry('POINT', srid=4326)) 

# Tabel 3: Rute
class Rute(Base):
    __tablename__ = "tabel_rute_final" 
    
    id_rute = Column(Integer, primary_key=True, index=True)
    kode_rute = Column(String)
    jenis_angkutan = Column(String)
    nama_rute = Column(String, nullable=False)
    rute_awal = Column(String)
    rute_akhir = Column(String)
    warna_jalur = Column(String)
    jam_operasional = Column(String)
    
    id_admin = Column(Integer, ForeignKey("admin_users.id_admin"))
    geom = Column(Geometry('LINESTRING', srid=4326))