from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

SQLALCHEMY_DATABASE_URL = "postgresql://postgres:figo1234@localhost:5432/tubessigfix"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Fungsi untuk membuka dan menutup koneksi database secara otomatis
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()