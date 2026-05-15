# WebGIS Transportasi Jakarta Timur

Project ini merupakan Tugas Besar Sistem Informasi Geografis dengan studi kasus **T1 — Sistem Informasi Rute Angkutan Umum**. Sistem ini berfokus pada visualisasi dan analisis rute angkutan umum di wilayah **Jakarta Timur**.

Aplikasi ini menampilkan data halte, rute angkutan umum, batas kecamatan, serta menyediakan fitur analisis spasial seperti pencarian halte dalam radius, rute yang beririsan dengan area tertentu, pengukuran jarak antarhalte, dan statistik transportasi per kecamatan.

---

## Anggota Kelompok

- Pradana Figo Ariansya — 123140063
- Awi Septian Prasetyo — 123140201
- Muhammad Bimastiar — 123140211

---

## Studi Kasus

**Tema:** Transportasi  
**Kode Studi Kasus:** T1  
**Judul:** Sistem Informasi Rute Angkutan Umum  
**Wilayah:** Jakarta Timur

Sistem ini menggunakan data spasial berupa:

- **Halte / titik pemberhentian** dalam bentuk `POINT`
- **Rute angkutan umum** dalam bentuk `MULTILINESTRING`
- **Batas kecamatan Jakarta Timur** dalam bentuk `MULTIPOLYGON`

---

## Teknologi yang Digunakan

### Backend

- Python
- FastAPI
- SQLAlchemy
- GeoAlchemy2
- PostgreSQL
- PostGIS

### Frontend

- ReactJS
- Vite
- React Leaflet
- Leaflet
- Axios
- Tailwind CSS

### Database

- PostgreSQL
- PostGIS Extension
- SRID: EPSG:4326

---

## Struktur Folder

```text
Tubes_sig/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── requirements.txt
│
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── main.jsx
│
├── database/
│   ├── normalisasi_dan_filter.sql
│   └── README.md
│
├── README.md
└── .gitignore
```

---

## Fitur Aplikasi

### 1. Visualisasi Peta Interaktif

Aplikasi menampilkan peta interaktif wilayah Jakarta Timur menggunakan Leaflet.

Layer yang tersedia:

- Layer halte
- Layer rute angkutan umum
- Layer batas kecamatan
- Basemap modern, OSM, satelit, terrain, dan dark mode
- Minimap

---

### 2. Data Halte

Data halte ditampilkan sebagai marker pada peta.

Informasi yang ditampilkan pada popup:

- ID halte
- Nama halte
- Alamat jalan
- Tipe halte
- Fasilitas shelter
- Rute terhubung
- Kategori layanan
- Status validasi

---

### 3. Data Rute

Data rute ditampilkan sebagai garis pada peta.

Informasi yang ditampilkan pada popup:

- Kode rute
- Nama rute
- Jenis angkutan
- Kategori layanan
- Jam operasional
- Estimasi panjang rute

---

### 4. Filter Jenis Angkutan

Sistem memiliki fitur filter berdasarkan kategori layanan angkutan umum.

Kategori yang digunakan:

- BRT
- Mikrotrans / Angkot
- Metrotrans
- Minitrans
- Royaltrans
- Trans Depok
- Bus Non-BRT
- Perlu Validasi Manual

Filter ini dibuat berdasarkan normalisasi kode rute dan klasifikasi dari atribut `kode_rute`, `nama_rute`, dan `jenis_angkutan`.

---

### 5. Analisis Radius Halte Terdekat

Pengguna dapat memilih titik pada peta dan menentukan radius pencarian.

Sistem akan menampilkan halte yang berada dalam radius tersebut menggunakan fungsi PostGIS:

```sql
ST_DWithin
```

---

### 6. Analisis Rute yang Memotong Area Radius

Sistem dapat menampilkan rute yang beririsan dengan area buffer dari titik yang dipilih.

Fungsi PostGIS yang digunakan:

```sql
ST_Buffer
ST_Intersects
```

---

### 7. Hitung Panjang Rute

Sistem dapat menghitung estimasi panjang rute menggunakan fungsi:

```sql
ST_Length
```

---

### 8. Hitung Jarak Antarhalte

Sistem dapat menghitung jarak antara dua halte menggunakan fungsi:

```sql
ST_Distance
```

---

### 9. Statistik Kecamatan

Sistem dapat menampilkan statistik transportasi per kecamatan, seperti:

- Jumlah halte dalam kecamatan
- Jumlah rute yang melewati kecamatan

Fungsi spasial yang digunakan:

```sql
ST_Intersects
```

---

### 10. CRUD Data

Admin dapat melakukan:

- Tambah data halte
- Edit data halte
- Hapus data halte
- Tambah data rute
- Edit data rute
- Hapus data rute

---

### 11. Login dan Register Admin

Sistem menyediakan fitur:

- Register admin
- Login admin
- Panel manajemen data untuk admin

---

## Ringkasan Data

Berdasarkan data yang digunakan dalam sistem:

| Data | Jumlah |
|---|---:|
| Halte / titik pemberhentian | 1031 data |
| Rute angkutan umum | 131 data |
| Kecamatan Jakarta Timur | 10 data |

Tipe geometri:

| Tabel | Tipe Geometri | SRID |
|---|---|---:|
| `tabel_halte_final` | POINT | 4326 |
| `tabel_rute_final` | MULTILINESTRING | 4326 |
| `kecamatan_jaktim_polygon` | MULTIPOLYGON | 4326 |

---

## Normalisasi Kode Rute

Pada data awal, terdapat beberapa perbedaan format penulisan kode rute, misalnya:

```text
JAK.02
JAK02
JAK002
```

Agar data lebih konsisten, dilakukan normalisasi kode rute dengan aturan:

1. Mengubah huruf menjadi kapital
2. Menghapus spasi di awal dan akhir
3. Menghapus tanda titik `.`
4. Menghapus nol berlebih setelah prefix `JAK`

Contoh hasil normalisasi:

```text
JAK.02  → JAK2
JAK02   → JAK2
JAK002  → JAK2
JAK016  → JAK16
JAK.85  → JAK85
```

Fungsi normalisasi yang digunakan:

```sql
CREATE OR REPLACE FUNCTION normalize_kode_rute(kode text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        regexp_replace(
            REPLACE(UPPER(TRIM($1)), '.', ''),
            '^JAK0+',
            'JAK'
        ),
        ''
    );
$$;
```

Setelah proses normalisasi, terdapat 3 kode yang tidak memiliki pasangan langsung pada tabel rute:

```text
5D
JAK14
M9
```

Ketiga kode tersebut tidak dihapus, tetapi diberi status validasi khusus:

| Kode | Kategori Sementara | Status |
|---|---|---|
| 5D | Perlu Validasi Manual | Tidak ditemukan pada tabel rute |
| JAK14 | Mikrotrans / Angkot | Inferensi berdasarkan prefix JAK |
| M9 | BRT | Inferensi berdasarkan prefix M |

---

## View Database Tambahan

Untuk mendukung fitur filter kategori, dibuat beberapa view tambahan:

### 1. `view_rute_kategori`

View ini digunakan untuk mengelompokkan rute berdasarkan kategori layanan.

Kategori ditentukan dari:

- `kode_rute`
- `nama_rute`
- `jenis_angkutan`

---

### 2. `view_halte_rute`

View ini digunakan untuk memecah kolom `rute_terhubung` pada halte.

Contoh:

```text
10D;7;7F;7B
```

dipecah menjadi:

```text
10D
7
7F
7B
```

---

### 3. `view_halte_kategori`

View ini menghubungkan halte dengan kategori layanan berdasarkan kode rute yang sudah dinormalisasi.

---

## Endpoint API

Backend berjalan menggunakan FastAPI dan menyediakan Swagger UI di:

```text
http://127.0.0.1:8000/docs
```

### Auth

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/register` | Register akun admin |
| POST | `/api/auth/login` | Login admin |

---

### Halte

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/halte` | Mengambil semua data halte |
| POST | `/api/halte` | Menambah halte |
| PUT | `/api/halte/{id_halte}` | Mengubah data halte |
| DELETE | `/api/halte/{id_halte}` | Menghapus halte |

---

### Rute

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/rute` | Mengambil semua data rute |
| POST | `/api/rute` | Menambah rute |
| PUT | `/api/rute/{id_rute}` | Mengubah data rute |
| DELETE | `/api/rute/{id_rute}` | Menghapus rute |

---

### Filter Kategori

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/kategori-rute` | Mengambil daftar kategori layanan |
| GET | `/api/rute/filter` | Mengambil semua rute dari view kategori |
| GET | `/api/rute/filter?kategori=BRT` | Filter rute berdasarkan kategori |
| GET | `/api/halte/filter?kategori=BRT` | Filter halte berdasarkan kategori |

Contoh kategori dengan karakter khusus:

```text
/api/rute/filter?kategori=Mikrotrans%20%2F%20Angkot
```

---

### Analisis Spasial

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/analisis/halte-terdekat` | Mencari halte dalam radius |
| GET | `/api/analisis/rute-intersect` | Mencari rute yang memotong area radius |
| GET | `/api/analisis/panjang-rute/{kode_rute}` | Menghitung panjang rute |
| GET | `/api/analisis/jarak-halte/{id_halte_1}/{id_halte_2}` | Menghitung jarak antarhalte |
| GET | `/api/analisis/statistik-kecamatan/{id_kecamatan}` | Statistik halte dan rute per kecamatan |

---

### Kecamatan

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/kecamatan` | Mengambil batas kecamatan Jakarta Timur |

---

## Cara Menjalankan Project

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/NAMA-REPOSITORY.git
cd NAMA-REPOSITORY
```

Ganti `USERNAME` dan `NAMA-REPOSITORY` sesuai repository GitHub.

---

## Setup Database

### 1. Buat Database

Masuk ke PostgreSQL:

```bash
psql -U postgres
```

Buat database:

```sql
CREATE DATABASE tubessig;
```

Masuk ke database:

```sql
\c tubessig
```

Aktifkan PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

### 2. Import Database

Jika tersedia file SQL:

```bash
psql -U postgres -d tubessig -f database/tubessig.sql
```

Jika menggunakan file dump custom:

```bash
pg_restore -U postgres -d tubessig database/tubessig.dump
```

---

### 3. Jalankan Query View Tambahan

Jika file query view tersedia:

```bash
psql -U postgres -d tubessig -f database/normalisasi_dan_filter.sql
```

Pastikan fungsi dan view berikut sudah ada:

```text
normalize_kode_rute()
view_rute_kategori
view_halte_rute
view_halte_kategori
```

---

## Setup Backend

Masuk ke folder backend:

```bash
cd backend
```

Buat virtual environment:

```bash
python -m venv venv
```

Aktifkan virtual environment:

```bash
venv\Scripts\activate
```

Install dependency:

```bash
pip install -r requirements.txt
```

Jika belum ada `requirements.txt`, install manual:

```bash
pip install fastapi uvicorn sqlalchemy geoalchemy2 psycopg2-binary pydantic
```

Jalankan backend:

```bash
python -m uvicorn main:app --reload
```

Backend berjalan di:

```text
http://127.0.0.1:8000
```

Swagger API:

```text
http://127.0.0.1:8000/docs
```

---

## Setup Frontend

Masuk ke folder frontend:

```bash
cd frontend
```

Install dependency:

```bash
npm install
```

Jalankan frontend:

```bash
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

---

## Konfigurasi Database Backend

File koneksi database berada di:

```text
backend/database.py
```

Pastikan koneksi sesuai dengan database lokal:

```python
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password_kamu@localhost:5432/tubessig"
```

Contoh:

```python
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:figo1234@localhost:5432/tubessig"
```

---

## Cara Menggunakan Aplikasi

1. Jalankan PostgreSQL dan pastikan database `tubessig` aktif.
2. Jalankan backend FastAPI.
3. Jalankan frontend React.
4. Buka aplikasi di browser.
5. Gunakan panel eksplorasi untuk:
   - mencari halte/rute,
   - menyalakan atau mematikan layer halte/rute,
   - memilih kategori jenis angkutan,
   - melakukan analisis radius,
   - melihat statistik kecamatan.
6. Login sebagai admin untuk mengelola data halte dan rute.

---

## Catatan Validasi Data

Data yang digunakan dalam sistem merupakan dataset operasional WebGIS. Jumlah halte dan rute mengacu pada jumlah data dalam database, bukan klaim jumlah resmi seluruh halte fisik di Jakarta Timur.

Beberapa catatan validasi:

- Kolom `alamat_jalan` pada sebagian besar data halte masih kosong.
- Kolom `fasilitas_shelter` belum lengkap pada semua halte.
- Beberapa kode rute memerlukan normalisasi format.
- Tiga kode rute, yaitu `5D`, `JAK14`, dan `M9`, belum memiliki pasangan langsung pada tabel rute.
- Relasi halte-rute saat ini berbasis kode pada kolom `rute_terhubung`, bukan tabel relasi many-to-many.
- Filter kategori menampilkan halte dan rute berdasarkan kategori layanan, bukan bukti bahwa setiap garis rute pasti melewati setiap halte yang tampil.

---

## Keterbatasan Sistem

1. Relasi halte dan rute masih berbasis teks kode rute.
2. Belum tersedia tabel relasi formal seperti `rute_halte`.
3. Beberapa atribut halte belum lengkap.
4. Validasi terhadap sumber resmi eksternal masih perlu dilakukan untuk beberapa kode rute.
5. Sistem belum memiliki autentikasi token seperti JWT.
6. Password admin masih menggunakan hash sederhana SHA-256.

---

## Pengembangan Selanjutnya

Beberapa pengembangan yang dapat dilakukan:

1. Membuat tabel relasi `rute_halte`.
2. Menambahkan validasi spasial halte-rute dengan `ST_DWithin`.
3. Membuat dashboard aksesibilitas transportasi per kecamatan.
4. Menambahkan skor aksesibilitas berdasarkan jumlah halte, jumlah rute, dan panjang rute.
5. Menambahkan export data ke CSV/GeoJSON.
6. Menambahkan role admin yang lebih aman dengan JWT.
7. Menambahkan validasi data dari sumber resmi seperti Transjakarta, JakLingko, OpenStreetMap, atau portal data pemerintah.

---

## Perintah Git yang Digunakan

Cek status:

```bash
git status
```

Tambah file:

```bash
git add .
```

Commit:

```bash
git commit -m "Tambah fitur filter kategori angkutan"
```

Push:

```bash
git push origin main
```

---

## File yang Tidak Diunggah ke GitHub

File berikut diabaikan melalui `.gitignore`:

```text
backend/venv/
backend/__pycache__/
*.pyc
frontend/node_modules/
.env
dist/
```

File tersebut tidak perlu diunggah karena dapat dibuat ulang secara lokal.

---

## Lisensi

Project ini dibuat untuk kebutuhan akademik Tugas Besar Sistem Informasi Geografis.

---

## Status Project

Project sudah memiliki:

- Backend FastAPI
- Frontend React Leaflet
- Database PostgreSQL/PostGIS
- Data halte, rute, dan kecamatan
- CRUD halte dan rute
- Analisis spasial
- Filter kategori jenis angkutan
- View normalisasi kode rute